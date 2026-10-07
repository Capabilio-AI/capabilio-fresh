import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadSkillIndex, recordUnresolved } from "@/lib/skills/store";
import { proposeAiMapping, type MappingImportance, type MappingRow, type MappingSource, type MappingStatus } from "@/lib/curriculum/mapping-rules";
import { suggestSkillsForCourses, type CourseForSkills, type SkillCandidates } from "../suggest";
import { resolveCandidates } from "./enrich";
import { pool } from "./pool";

type Service = SupabaseClient<Database>;
export type Suggest = (courses: CourseForSkills[], catalog: { name: string; category: string }[]) => Promise<SkillCandidates["results"]>;

const BATCH = 4;
const CONCURRENCY = 2;
/** Courses handled per request: keeps one call well inside the 300 s route limit; the caller repeats until `remaining` is 0. */
export const DEFAULT_COURSES_PER_REQUEST = 12;
const MARK = "_skillsSuggestedAt";

export type SuggestSkillsResult =
  | { ok: true; processed: number; remaining: number; suggested: number; unresolved: number; failedBatches: number }
  | { ok: false; status: number; message: string };

const asRow = (r: { skill_id: string; status: string; mapping_source: string; confidence: number | null; importance: string | null; evidence_source: string | null; approved_by: string | null; approved_at: string | null }): MappingRow => ({
  skillId: r.skill_id, status: r.status as MappingStatus, source: r.mapping_source as MappingSource, confidence: r.confidence, importance: r.importance as MappingImportance | null,
  evidence: r.evidence_source, approvedBy: r.approved_by, approvedAt: r.approved_at,
});

/**
 * Suggests canonical skills for the next unprocessed courses of ONE unpublished import, as SUGGESTED / AI_SUGGESTED rows.
 * Idempotent and resumable: a course is marked once handled; a CONFIRMED or REJECTED mapping is never touched (proposeAiMapping);
 * a failed batch leaves its courses unmarked so they are retried. Names that do not resolve go to the review queue, never into `skills`.
 */
export async function suggestSkillsForImport(
  service: Service,
  ctx: { institutionId: string },
  importId: string,
  opts: { limit?: number; suggest?: Suggest } = {}
): Promise<SuggestSkillsResult> {
  const suggest: Suggest = opts.suggest ?? suggestSkillsForCourses;
  const { data: imp } = await service.from("curriculum_imports").select("id, status, institution_id, deleted_at").eq("id", importId).eq("institution_id", ctx.institutionId).is("deleted_at", null).maybeSingle();
  if (!imp) return { ok: false, status: 404, message: "Curriculum not found." };
  if (imp.status === "PUBLISHED" || imp.status === "ARCHIVED") return { ok: false, status: 409, message: "A published curriculum can't be changed. Create a new version." };

  const { data: all } = await service.from("courses").select("id, title, objectives, provenance").eq("import_id", importId).order("sort_order");
  const pending = (all ?? []).filter((c) => !(c.provenance as Record<string, unknown> | null)?.[MARK]);
  const todo = pending.slice(0, opts.limit ?? DEFAULT_COURSES_PER_REQUEST);
  if (todo.length === 0) return { ok: true, processed: 0, remaining: 0, suggested: 0, unresolved: 0, failedBatches: 0 };
  const ids = todo.map((c) => c.id);

  const [{ data: outcomes }, { data: units }, { data: topics }, { data: labs }, { data: catalogRows }, index, { data: haveCourse }, { data: haveOutcome }] = await Promise.all([
    service.from("course_outcomes").select("id, course_id, code, text").in("course_id", ids).order("sort_order"),
    service.from("course_units").select("course_id, title").in("course_id", ids).order("unit_no"),
    service.from("unit_topics").select("course_id, text").in("course_id", ids),
    service.from("lab_experiments").select("course_id, text").in("course_id", ids).order("sort_order"),
    service.from("skills").select("name, category").eq("status", "active").order("category").order("name"),
    loadSkillIndex(service),
    service.from("course_skill_mappings").select("course_id, skill_id, status, mapping_source, confidence, importance, evidence_source, approved_by, approved_at").in("course_id", ids),
    service.from("course_outcome_skill_mappings").select("course_outcome_id, course_id, skill_id, status, mapping_source, confidence, importance, evidence_source, approved_by, approved_at").in("course_id", ids),
  ]);
  const catalog = (catalogRows ?? []).map((s) => ({ name: s.name, category: s.category ?? "" }));
  const by = <T extends { course_id: string }>(rows: T[] | null, id: string) => (rows ?? []).filter((r) => r.course_id === id);

  const content = new Map<string, { course: CourseForSkills; text: string }>();
  for (const c of todo) {
    const o = by(outcomes, c.id);
    const u = by(units, c.id).map((x) => x.title);
    const l = by(labs, c.id).map((x) => x.text);
    const course: CourseForSkills = { id: c.id, title: c.title, objectives: c.objectives ?? [], outcomes: o.map((x) => ({ code: x.code, text: x.text })), unitTitles: u, experiments: l };
    // The text every candidate's evidence is checked against: only what is stored for this course.
    const text = [c.title, ...course.objectives, ...course.outcomes.map((x) => `${x.code}: ${x.text}`), ...u, ...by(topics, c.id).map((x) => x.text), ...l].join("\n");
    content.set(c.id, { course, text });
  }

  const handled = new Set<string>();
  let suggested = 0;
  let unresolved = 0;
  let failedBatches = 0;
  const newCourseRows: Database["public"]["Tables"]["course_skill_mappings"]["Insert"][] = [];
  const newOutcomeRows: Database["public"]["Tables"]["course_outcome_skill_mappings"]["Insert"][] = [];
  const updates: PromiseLike<{ error: { message: string } | null }>[] = [];
  const empty = todo.filter((c) => { const x = content.get(c.id)!.course; return x.objectives.length + x.outcomes.length + x.unitTitles.length + x.experiments.length === 0; });
  empty.forEach((c) => handled.add(c.id)); // nothing to read: marked, so it is not retried forever

  const batches: string[][] = [];
  const withContent = todo.filter((c) => !handled.has(c.id)).map((c) => c.id);
  for (let i = 0; i < withContent.length; i += BATCH) batches.push(withContent.slice(i, i + BATCH));

  await pool(batches, CONCURRENCY, async (batch) => {
    let results: SkillCandidates["results"];
    try {
      results = await suggest(batch.map((id) => content.get(id)!.course), catalog);
    } catch {
      failedBatches++;
      return;
    }
    for (const id of batch) {
      const { course, text } = content.get(id)!;
      const found = results.find((r) => r.id === id);
      const resolved = resolveCandidates(found?.skills ?? [], index, { sectionText: text, outcomeCodes: new Set(course.outcomes.map((o) => o.code)) });
      for (const u of resolved.unresolved) {
        unresolved++;
        await recordUnresolved(service, u.name, "course_mapping").catch(() => undefined);
      }
      for (const m of resolved.mappings) {
        const existing = (haveCourse ?? []).find((r) => r.course_id === id && r.skill_id === m.skillId);
        const proposal = proposeAiMapping(existing ? asRow(existing) : null, { skillId: m.skillId, confidence: m.confidence, evidence: m.evidence.slice(0, 500) });
        if (proposal.action === "insert") {
          newCourseRows.push({ course_id: id, skill_id: m.skillId, mapping_source: "AI_SUGGESTED", confidence: m.confidence, evidence_source: m.evidence.slice(0, 500), status: "SUGGESTED" });
          suggested++;
        } else if (proposal.action === "update") {
          updates.push(service.from("course_skill_mappings").update({ confidence: m.confidence, evidence_source: m.evidence.slice(0, 500) }).eq("course_id", id).eq("skill_id", m.skillId).eq("status", "SUGGESTED"));
        }
        for (const code of m.outcomeCodes) {
          const outcome = (outcomes ?? []).find((o) => o.course_id === id && o.code === code);
          if (!outcome) continue;
          const had = (haveOutcome ?? []).find((r) => r.course_outcome_id === outcome.id && r.skill_id === m.skillId);
          const p = proposeAiMapping(had ? asRow(had) : null, { skillId: m.skillId, confidence: m.confidence, evidence: m.evidence.slice(0, 500) });
          if (p.action === "insert") newOutcomeRows.push({ course_outcome_id: outcome.id, course_id: id, skill_id: m.skillId, mapping_source: "AI_SUGGESTED", confidence: m.confidence, evidence_source: m.evidence.slice(0, 500), status: "SUGGESTED" });
        }
      }
      handled.add(id);
    }
  });

  if (newCourseRows.length) {
    const { error } = await service.from("course_skill_mappings").insert(newCourseRows);
    if (error) return { ok: false, status: 500, message: "Could not save the suggestions." };
  }
  if (newOutcomeRows.length) {
    const { error } = await service.from("course_outcome_skill_mappings").insert(newOutcomeRows);
    if (error) return { ok: false, status: 500, message: "Could not save the suggestions." };
  }
  // Every write is checked: a progress mark that silently failed would make the next call redo (and re-bill) the same courses.
  const now = new Date().toISOString();
  const writes = await Promise.all([
    ...updates,
    ...todo.filter((c) => handled.has(c.id)).map((c) => service.from("courses").update({ provenance: { ...((c.provenance as Record<string, unknown> | null) ?? {}), [MARK]: now } as never }).eq("id", c.id)),
  ]);
  if (writes.some((w) => w.error)) return { ok: false, status: 500, message: "Could not record progress. Try again — nothing was duplicated." };

  return { ok: true, processed: handled.size, remaining: pending.length - handled.size, suggested, unresolved, failedBatches };
}
