import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { loadSkillIndex } from "@/lib/skills/store";
import { saveExtractionAsImport } from "@/lib/roadmap/extract/persist";
import { buildFromTemplate, DECLARED_EVIDENCE } from "./build";
import { parseCurriculumTemplate, type TemplateIssue } from "./parse";
import { TEMPLATE_VERSION } from "./spec";

type Service = SupabaseClient<Database>;

export type TemplateImportResult =
  | { ok: true; importId: string; courses: number; warnings: string[] }
  | { ok: false; status: number; message: string; issues?: TemplateIssue[] };

const MAX_LISTED = 8;
const listed = (items: string[]) => (items.length > MAX_LISTED ? `${items.slice(0, MAX_LISTED).join(", ")} and ${items.length - MAX_LISTED} more` : items.join(", "));

/**
 * Reads a Capabilio template and saves it as a draft curriculum (status EXTRACTED), exactly where a PDF extraction would land, so the same
 * review, analysis and publish steps follow. Deterministic: nothing is inferred. Skills the college stated become confirmed mappings; courses
 * it left thin are filled in by the usual analysis, which never overrides what the college stated.
 */
export async function importTemplate(
  service: Service,
  admin: { institutionId: string; userId: string },
  input: { branch: string; regulation: string | null; program: string | null; fileName: string; text: string }
): Promise<TemplateImportResult> {
  const parsed = parseCurriculumTemplate(input.text);
  if (!parsed.ok) return { ok: false, status: 422, message: "The file has problems. Fix them and upload it again.", issues: parsed.issues };

  const built = buildFromTemplate(parsed.courses, await loadSkillIndex(service));
  const warnings = parsed.notes.map((n) => (n.line ? `Line ${n.line}: ${n.message}` : n.message));
  if (built.unmatchedSkills.length > 0) {
    const names = [...new Set(built.unmatchedSkills.map((s) => `${s.name} (${s.course})`))];
    warnings.push(`${built.unmatchedSkills.length} skill row(s) were not in the Capabilio skills list and were skipped: ${listed(names)}. Download the skills list for the accepted names.`);
  }
  if (built.thinCourses.length > 0) warnings.push(`${built.thinCourses.length} course(s) have no objectives, outcomes or units: ${listed(built.thinCourses)}. Capabilio will work from their titles only.`);

  const importId = await saveExtractionAsImport(service, {
    institutionId: admin.institutionId, userId: admin.userId, branch: input.branch, fileName: input.fileName, regulation: input.regulation, program: input.program,
    courses: built.courses, outcomes: [],
    summary: { source: "template", templateVersion: TEMPLATE_VERSION, warnings, unmatchedSkills: built.unmatchedSkills.length },
    model: "capabilio-template", version: TEMPLATE_VERSION,
  });

  try {
    const db = untyped(service);
    const { data: rows } = await db.from("courses").select("id, course_code").eq("import_id", importId);
    const idByCode = new Map(((rows ?? []) as { id: string; course_code: string | null }[]).map((r) => [(r.course_code ?? "").toLowerCase(), r.id]));
    const courseIds = parsed.courses.map((c) => idByCode.get(c.code.toLowerCase()));

    // The college's own statements, as its confirmed mappings: written here, a separate path from the AI extraction (which only ever suggests).
    const now = new Date().toISOString();
    const stated = { mapping_source: "MANUAL", status: "CONFIRMED", evidence_source: DECLARED_EVIDENCE, created_by: admin.userId, approved_by: admin.userId, approved_at: now } as const;
    const allIds = courseIds.filter((id): id is string => Boolean(id));
    const { data: outcomeRows } = allIds.length ? await db.from("course_outcomes").select("id, course_id, code").in("course_id", allIds) : { data: [] };
    const outcomeId = new Map(((outcomeRows ?? []) as { id: string; course_id: string; code: string }[]).map((o) => [`${o.course_id}|${o.code}`, o.id]));
    const courseMaps: Record<string, unknown>[] = [];
    const outcomeMaps: Record<string, unknown>[] = [];
    built.declared.forEach((skills, i) => {
      const course = courseIds[i];
      if (!course) return;
      for (const s of skills) {
        courseMaps.push({ course_id: course, skill_id: s.skillId, importance: s.importance, confidence: null, ...stated });
        for (const code of s.outcomeCodes) {
          const outcome = outcomeId.get(`${course}|${code}`);
          if (outcome) outcomeMaps.push({ course_id: course, course_outcome_id: outcome, skill_id: s.skillId, importance: s.importance, confidence: null, ...stated });
        }
      }
    });
    for (const [table, rows] of [["course_skill_mappings", courseMaps], ["course_outcome_skill_mappings", outcomeMaps]] as const) {
      if (rows.length === 0) continue;
      const { error } = await db.from(table).insert(rows);
      if (error) throw new Error(`${table}: ${error.message}`);
    }

    // A course whose skills the college stated is done: the AI skill pass skips it instead of adding its own guesses next to them.
    const done = built.declared.map((skills, i) => (skills.length > 0 ? courseIds[i] : undefined)).filter((id): id is string => Boolean(id));
    if (done.length > 0) {
      const { error } = await db.from("courses").update({ skills_analysed_at: now }).in("id", done);
      if (error) throw new Error(`courses: ${error.message}`);
    }

    if (built.unitSkills.length > 0) {
      const { data: units } = await db.from("course_units").select("id, course_id, unit_no").in("course_id", courseIds.filter((id): id is string => Boolean(id)));
      const unitId = new Map(((units ?? []) as { id: string; course_id: string; unit_no: number }[]).map((u) => [`${u.course_id}|${u.unit_no}`, u.id]));
      const seen = new Set<string>();
      const rowsOut = built.unitSkills.flatMap((s) => {
        const course = courseIds[s.courseIndex];
        const unit = course ? unitId.get(`${course}|${s.unitNo}`) : undefined;
        if (!course || !unit || seen.has(`${unit}|${s.skillId}`)) return [];
        seen.add(`${unit}|${s.skillId}`);
        return [{ unit_id: unit, course_id: course, skill_id: s.skillId, ...stated }];
      });
      if (rowsOut.length > 0) {
        const { error } = await db.from("unit_skill_mappings").insert(rowsOut);
        if (error) throw new Error(`unit_skill_mappings: ${error.message}`);
      }
    }
  } catch (e) {
    await service.from("curriculum_imports").delete().eq("id", importId); // a draft: its children cascade
    throw e;
  }
  return { ok: true, importId, courses: parsed.courses.length, warnings };
}
