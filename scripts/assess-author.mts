// Imports hand-authored general-assessment questions (no AI calls). Usage: npm run assess:author [-- data/assess-questions/file.json]
// Safe to re-run: a question already stored (same content hash) is skipped.
import { readdirSync, readFileSync } from "node:fs";
import { createServiceClient } from "@/lib/supabase/service";
import { SECTION_SPECS } from "@/lib/question-bank/generate";
import { storeQuestions } from "@/lib/assess/generate";
import { validateQuestion, type ValidQuestion } from "@/lib/assess/validate";
import { toGenerated } from "@/lib/assess/datasets";
import type { GeneralSlot } from "@/lib/assess/slots";
import type { AssessmentSection } from "@/lib/assessment/sections";
import type { Difficulty } from "@/lib/assess/config";

type Authored = { d: Difficulty; skill: string; q: string; o: string[]; a: number; e: string };
const DIR = "data/assess-questions";
const db = createServiceClient() as never;
const files = process.argv[2] ? [process.argv[2]] : readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => `${DIR}/${f}`);

for (const file of files) {
  const { section, questions } = JSON.parse(readFileSync(file, "utf8")) as { section: Exclude<AssessmentSection, "career_interests">; questions: Authored[] };
  const spec = SECTION_SPECS[section];
  const slot: GeneralSlot = { kind: "GENERAL", section, label: spec.label, skills: spec.skills, guidance: spec.guidance };
  const valid: ValidQuestion[] = [];
  for (const r of questions) {
    const raw = { question: r.q, options: r.o, answer: r.o[r.a], explanation: r.e };
    const v = validateQuestion(toGenerated(raw, section, r.skill, r.d), { skillKey: section, careerKey: null, difficulty: r.d, minQuestionLength: 25 });
    if (v.ok) valid.push(v.question); else console.log(`  rejected "${r.q.slice(0, 50)}…": ${v.reason}`);
  }
  const stored = await storeQuestions(db, slot, valid, { provider: "authored", model: "claude", promptVersion: "authored", dataset: { name: "capabilio-authored", license: "proprietary" } });
  console.log(`${file}: ${valid.length} valid, ${stored} new, ${questions.length - valid.length} rejected`);
}
