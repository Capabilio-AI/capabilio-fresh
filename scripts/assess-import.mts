// Downloads open-dataset questions for the common assessment into the shared pool. Usage:
//   npm run assess:import                 (every source)
//   npm run assess:import -- basic_sciences   (only one section)
// Safe to re-run: a question already stored (same content hash) is skipped.
import { createServiceClient } from "@/lib/supabase/service";
import { SECTION_SPECS } from "@/lib/question-bank/generate";
import { SOURCES, toGenerated, type DatasetSource } from "@/lib/assess/datasets";
import { storeQuestions } from "@/lib/assess/generate";
import { validateQuestion, type ValidQuestion } from "@/lib/assess/validate";
import type { GeneralSlot } from "@/lib/assess/slots";
import type { AssessmentSection } from "@/lib/assessment/sections";

const db = createServiceClient() as never;
const only = process.argv[2];
const PAGE = 100;

async function rows(src: DatasetSource): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=${src.hf}&config=${src.config}&split=${src.split}&offset=${offset}&length=${PAGE}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${src.dataset}: HTTP ${res.status}`);
    const body = (await res.json()) as { rows: { row: Record<string, unknown> }[]; num_rows_total: number };
    out.push(...body.rows.map((r) => r.row));
    if (offset + PAGE >= body.num_rows_total || body.rows.length === 0) return out;
  }
}

for (const src of SOURCES.filter((s) => !only || s.section === only)) {
  const spec = SECTION_SPECS[src.section as Exclude<AssessmentSection, "career_interests">];
  const slot: GeneralSlot = { kind: "GENERAL", section: src.section, label: spec.label, skills: spec.skills, guidance: spec.guidance };
  const valid: ValidQuestion[] = [];
  let skipped = 0;
  for (const row of await rows(src)) {
    if (valid.length >= src.max) break;
    const raw = src.read(row);
    if (!raw) { skipped++; continue; }
    const difficulty = typeof src.level === "function" ? src.level(raw) : src.level;
    const v = validateQuestion(toGenerated(raw, src.section, spec.label, difficulty), { skillKey: src.section, careerKey: null, difficulty, minQuestionLength: 25 });
    if (v.ok) valid.push(v.question); else skipped++;
  }
  // storeQuestions files each question under its own difficulty, so one call per source is enough
  const stored = await storeQuestions(db, slot, valid, { provider: "huggingface", model: src.dataset, promptVersion: "dataset", dataset: { name: src.dataset, license: src.license } });
  console.log(`${src.section} <- ${src.dataset}: ${valid.length} valid, ${stored} new, ${skipped} skipped`);
}
