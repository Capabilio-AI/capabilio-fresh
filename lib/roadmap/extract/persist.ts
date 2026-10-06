import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ParsedSection } from "./section";
import type { SkillMappingCandidate } from "./enrich";
import type { ProgramOutcome } from "./programs";
import type { CandidateRow } from "./types";

type Service = SupabaseClient<Database>;
type Insert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];

export interface PersistCourse {
  row: Pick<CandidateRow, "year" | "semester" | "name" | "code" | "category" | "kind">;
  parsed: ParsedSection;
  structuredBy: "parser" | "ai";
  mappings: SkillMappingCandidate[];
}
export interface PersistInput {
  institutionId: string;
  userId: string;
  branch: string;
  fileName: string;
  regulation: string | null;
  program: string | null;
  courses: PersistCourse[];
  outcomes: ProgramOutcome[];
  summary: Record<string, unknown>;
  model: string;
  version: string;
}

const CHUNK = 200;
async function insertMany<T extends keyof Database["public"]["Tables"]>(service: Service, table: T, rows: Insert<T>[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await service.from(table).insert(rows.slice(i, i + CHUNK) as never);
    if (error) throw new Error(`${String(table)}: ${error.message}`);
  }
}
async function insertReturning<T extends keyof Database["public"]["Tables"], R>(service: Service, table: T, rows: Insert<T>[], columns: string): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { data, error } = await service.from(table).insert(rows.slice(i, i + CHUNK) as never).select(columns);
    if (error) throw new Error(`${String(table)}: ${error.message}`);
    out.push(...((data ?? []) as unknown as R[]));
  }
  return out;
}

/** (year, lower(title)) is unique per import; a repeated title in another semester is told apart by its semester. */
function uniqueTitles(courses: PersistCourse[]): string[] {
  const seen = new Set<string>();
  return courses.map((c) => {
    let title = c.row.name.trim().slice(0, 200);
    const key = (t: string) => `${c.row.year}|${t.toLowerCase()}`;
    if (seen.has(key(title))) title = `${title.slice(0, 180)} (Semester ${c.row.semester})`;
    for (let n = 2; seen.has(key(title)); n++) title = `${title.slice(0, 170)} #${n}`;
    seen.add(key(title));
    return title;
  });
}

const LAB = /\blab(oratory)?\b/i;

/**
 * Writes one extraction as a curriculum_imports row in status EXTRACTED with its whole course tree. Everything AI-derived is stored
 * as SUGGESTED / AI_SUGGESTED (the database refuses AI_SUGGESTED + CONFIRMED), so nothing here can reach a student's roadmap.
 * On any failure the draft import is deleted (a draft is deletable; its children cascade) and the error is rethrown.
 */
export async function saveExtractionAsImport(service: Service, input: PersistInput): Promise<string> {
  const { data: imp, error } = await service
    .from("curriculum_imports")
    .insert({
      institution_id: input.institutionId, branch: input.branch, program: input.program, regulation: input.regulation,
      source_file_name: input.fileName.slice(0, 300), status: "DRAFT", created_by: input.userId,
      extraction_model: input.model, extraction_version: input.version,
    })
    .select("id")
    .single();
  if (error || !imp) throw new Error(`curriculum_imports: ${error?.message ?? "no row"}`);
  const importId = imp.id;
  try {
    const titles = uniqueTitles(input.courses);
    const courseRows: Insert<"courses">[] = input.courses.map((c, i) => ({
      import_id: importId, year: c.row.year, semester: c.row.semester, course_code: c.row.code, title: titles[i], category: c.row.category,
      kind: c.row.kind, lecture_hours: c.parsed.ltpc?.l ?? null, tutorial_hours: c.parsed.ltpc?.t ?? null, practical_hours: c.parsed.ltpc?.p ?? null,
      credits: c.parsed.ltpc?.c ?? null, prerequisites: c.parsed.prerequisites, objectives: c.parsed.objectives,
      is_elective: c.row.kind === "elective_option" || /elective/i.test(c.row.category ?? ""), is_lab: c.row.kind === "lab" || LAB.test(titles[i]),
      textbooks: c.parsed.textbooks.length ? c.parsed.textbooks : null, reference_books: c.parsed.referenceBooks.length ? c.parsed.referenceBooks : null,
      online_resources: c.parsed.onlineResources.length ? c.parsed.onlineResources : null,
      provenance: { ...c.parsed.provenance, _structuredBy: c.structuredBy }, sort_order: i,
    }));
    const created = await insertReturning<"courses", { id: string; year: number; title: string }>(service, "courses", courseRows, "id, year, title");
    const idOf = new Map(created.map((c) => [`${c.year}|${c.title.toLowerCase()}`, c.id]));
    const courseIds = input.courses.map((c, i) => idOf.get(`${c.row.year}|${titles[i].toLowerCase()}`)!);

    const outcomeRows: Insert<"course_outcomes">[] = [];
    const unitRows: Insert<"course_units">[] = [];
    const labRows: Insert<"lab_experiments">[] = [];
    input.courses.forEach((c, i) => {
      c.parsed.outcomes.forEach((o, k) => outcomeRows.push({ course_id: courseIds[i], code: o.code, text: o.text, bloom_level: o.bloom, sort_order: k, provenance: c.parsed.provenance.outcomes ?? null }));
      c.parsed.units.forEach((u) => unitRows.push({ course_id: courseIds[i], unit_no: u.unitNo, title: u.title, hours: u.hours }));
      c.parsed.experiments.forEach((text, k) => labRows.push({ course_id: courseIds[i], text, sort_order: k }));
    });
    const outcomes = await insertReturning<"course_outcomes", { id: string; course_id: string; code: string }>(service, "course_outcomes", outcomeRows, "id, course_id, code");
    const units = await insertReturning<"course_units", { id: string; course_id: string; unit_no: number }>(service, "course_units", unitRows, "id, course_id, unit_no");
    await insertMany(service, "lab_experiments", labRows);

    const unitId = new Map(units.map((u) => [`${u.course_id}|${u.unit_no}`, u.id]));
    const topicRows: Insert<"unit_topics">[] = [];
    input.courses.forEach((c, i) => c.parsed.units.forEach((u) => u.topics.forEach((text, k) => topicRows.push({ unit_id: unitId.get(`${courseIds[i]}|${u.unitNo}`)!, course_id: courseIds[i], text, sort_order: k }))));
    await insertMany(service, "unit_topics", topicRows);

    await insertMany(service, "program_outcomes", input.outcomes.map((o, i): Insert<"program_outcomes"> => ({ import_id: importId, kind: o.kind, code: o.code, text: o.text, sort_order: i })));

    const outcomeId = new Map(outcomes.map((o) => [`${o.course_id}|${o.code}`, o.id]));
    const courseMaps: Insert<"course_skill_mappings">[] = [];
    const outcomeMaps: Insert<"course_outcome_skill_mappings">[] = [];
    input.courses.forEach((c, i) =>
      c.mappings.forEach((m) => {
        const base = { skill_id: m.skillId, mapping_source: "AI_SUGGESTED", confidence: m.confidence, evidence_source: m.evidence.slice(0, 500), status: "SUGGESTED", created_by: input.userId } as const;
        courseMaps.push({ course_id: courseIds[i], ...base });
        for (const code of m.outcomeCodes) {
          const id = outcomeId.get(`${courseIds[i]}|${code}`);
          if (id) outcomeMaps.push({ course_outcome_id: id, course_id: courseIds[i], ...base });
        }
      })
    );
    await insertMany(service, "course_skill_mappings", courseMaps);
    await insertMany(service, "course_outcome_skill_mappings", outcomeMaps);

    const { error: up } = await service
      .from("curriculum_imports")
      .update({ status: "EXTRACTED", extraction_summary: { ...input.summary, courses: courseRows.length, outcomes: outcomeRows.length, units: unitRows.length, topics: topicRows.length, experiments: labRows.length, programOutcomes: input.outcomes.length, mappings: courseMaps.length, outcomeMappings: outcomeMaps.length } as never })
      .eq("id", importId);
    if (up) throw new Error(`curriculum_imports: ${up.message}`);
    return importId;
  } catch (e) {
    await service.from("curriculum_imports").delete().eq("id", importId);
    throw e;
  }
}
