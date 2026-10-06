import type { Database } from "@/lib/supabase/types";
import { confirmMapping, rejectMapping, type MappingImportance, type MappingRow, type MappingSource, type MappingStatus } from "./mapping-rules";
import { dbFailure, FROZEN_MESSAGE, ownedCourse, type Admin, type Result } from "./writes";
import { getOwnedImport } from "./admin-data";
import type { SupabaseClient } from "@supabase/supabase-js";

type Service = SupabaseClient<Database>;
type Decision = { skillId: string; decision: "confirm" | "reject" | "clear"; importance?: MappingImportance | null; outcomeId?: string };
type DbRow = { id: string; skill_id: string; status: string; mapping_source: string; confidence: number | null; importance: string | null; evidence_source: string | null; approved_by: string | null; approved_at: string | null; course_outcome_id?: string };
const fail = (status: number, message: string): { ok: false; status: number; message: string } => ({ ok: false, status, message });
const asRow = (r: DbRow): MappingRow => ({ skillId: r.skill_id, status: r.status as MappingStatus, source: r.mapping_source as MappingSource, confidence: r.confidence, importance: r.importance as MappingImportance | null, evidence: r.evidence_source, approvedBy: r.approved_by, approvedAt: r.approved_at });
const SELECT = "id, skill_id, status, mapping_source, confidence, importance, evidence_source, approved_by, approved_at";

/**
 * The college's decisions on one course's skills (course level, and outcome level when `outcomeId` is given). The rules are the pure
 * ones in mapping-rules.ts; WHO approved and WHEN come from the session and the clock, never from the request. Rejecting a skill the AI
 * suggested stores REJECTED (so it is not suggested again); "clear" removes a row entirely.
 */
export async function applyDecisions(service: Service, admin: Admin, courseId: string, decisions: Decision[]): Promise<Result<{ confirmed: number; rejected: number; cleared: number; skipped: number }>> {
  const owned = await ownedCourse(service, admin.institutionId, courseId);
  if (!owned) return fail(404, "Course not found.");
  if (owned.imp.status === "PUBLISHED" || owned.imp.status === "ARCHIVED") return fail(409, FROZEN_MESSAGE);

  const skillIds = [...new Set(decisions.map((d) => d.skillId))];
  const outcomeIds = [...new Set(decisions.flatMap((d) => (d.outcomeId ? [d.outcomeId] : [])))];
  const [{ data: skills }, { data: outcomes }, { data: cm }, { data: om }] = await Promise.all([
    service.from("skills").select("id").eq("status", "active").in("id", skillIds),
    outcomeIds.length ? service.from("course_outcomes").select("id").eq("course_id", courseId).in("id", outcomeIds) : { data: [] as { id: string }[] },
    service.from("course_skill_mappings").select(SELECT).eq("course_id", courseId),
    service.from("course_outcome_skill_mappings").select(`${SELECT}, course_outcome_id`).eq("course_id", courseId),
  ]);
  if ((skills ?? []).length !== skillIds.length) return fail(400, "One of those skills isn't in the skill catalog.");
  if ((outcomes ?? []).length !== outcomeIds.length) return fail(400, "One of those outcomes doesn't belong to this course.");

  const now = new Date().toISOString();
  const counts = { confirmed: 0, rejected: 0, cleared: 0, skipped: 0 };
  const inserts = { course: [] as Database["public"]["Tables"]["course_skill_mappings"]["Insert"][], outcome: [] as Database["public"]["Tables"]["course_outcome_skill_mappings"]["Insert"][] };
  const writes: PromiseLike<{ error: { code?: string; message?: string } | null }>[] = [];
  const deletes = { course: [] as string[], outcome: [] as string[] };

  for (const d of decisions) {
    const table = d.outcomeId ? "course_outcome_skill_mappings" : "course_skill_mappings";
    const existing = d.outcomeId ? ((om ?? []) as DbRow[]).find((r) => r.course_outcome_id === d.outcomeId && r.skill_id === d.skillId) : ((cm ?? []) as DbRow[]).find((r) => r.skill_id === d.skillId);
    if (d.decision === "clear") {
      if (existing) (d.outcomeId ? deletes.outcome : deletes.course).push(existing.id);
      counts[existing ? "cleared" : "skipped"]++;
      continue;
    }
    if (d.decision === "reject" && !existing) { counts.skipped++; continue; } // nothing was proposed, so there is nothing to reject
    const next = d.decision === "confirm" ? confirmMapping(existing ? asRow(existing) : null, { userId: admin.userId, now, skillId: d.skillId }) : rejectMapping(asRow(existing!), { userId: admin.userId, now });
    const importance = d.importance !== undefined ? d.importance : next.importance;
    counts[d.decision === "confirm" ? "confirmed" : "rejected"]++;
    if (existing) {
      writes.push(service.from(table).update({ status: next.status, mapping_source: next.source, importance, approved_by: next.approvedBy, approved_at: next.approvedAt }).eq("id", existing.id));
    } else {
      const base = { skill_id: d.skillId, mapping_source: next.source, importance, status: next.status, created_by: admin.userId, approved_by: next.approvedBy, approved_at: next.approvedAt } as const;
      if (d.outcomeId) inserts.outcome.push({ ...base, course_outcome_id: d.outcomeId, course_id: courseId });
      else inserts.course.push({ ...base, course_id: courseId });
    }
  }

  const results = await Promise.all([
    ...writes,
    ...(inserts.course.length ? [service.from("course_skill_mappings").insert(inserts.course)] : []),
    ...(inserts.outcome.length ? [service.from("course_outcome_skill_mappings").insert(inserts.outcome)] : []),
    ...(deletes.course.length ? [service.from("course_skill_mappings").delete().in("id", deletes.course)] : []),
    ...(deletes.outcome.length ? [service.from("course_outcome_skill_mappings").delete().in("id", deletes.outcome)] : []),
  ]);
  const failed = results.find((r) => r.error);
  return failed?.error ? dbFailure(failed.error, "applyDecisions") : { ok: true, ...counts };
}

export interface HighConfidencePreview {
  count: number;
  courseLevel: number;
  outcomeLevel: number;
  courses: number;
  sample: { course: string; skill: string; confidence: number }[];
}

/**
 * "Confirm all high-confidence suggestions": allowed only as an explicit second step. `preview` lists exactly what would be confirmed;
 * the confirming call must carry that list's size, and is refused if the list has changed since.
 */
export async function confirmHighConfidence(service: Service, admin: Admin, importId: string, opts: { minConfidence: number; preview: boolean; expectedCount?: number }): Promise<Result<{ preview: HighConfidencePreview; confirmed: number }>> {
  const imp = await getOwnedImport(service, admin.institutionId, importId);
  if (!imp) return fail(404, "Curriculum not found.");
  if (imp.status === "PUBLISHED" || imp.status === "ARCHIVED") return fail(409, FROZEN_MESSAGE);

  const { data: courses } = await service.from("courses").select("id, title").eq("import_id", importId).is("deleted_at", null);
  const ids = (courses ?? []).map((c) => c.id);
  const title = new Map((courses ?? []).map((c) => [c.id, c.title]));
  if (ids.length === 0) return { ok: true, confirmed: 0, preview: { count: 0, courseLevel: 0, outcomeLevel: 0, courses: 0, sample: [] } };
  const [{ data: cm }, { data: om }, { data: skills }] = await Promise.all([
    service.from("course_skill_mappings").select("id, course_id, skill_id, confidence").in("course_id", ids).eq("status", "SUGGESTED").eq("mapping_source", "AI_SUGGESTED").gte("confidence", opts.minConfidence),
    service.from("course_outcome_skill_mappings").select("id, course_id, skill_id, confidence").in("course_id", ids).eq("status", "SUGGESTED").eq("mapping_source", "AI_SUGGESTED").gte("confidence", opts.minConfidence),
    service.from("skills").select("id, name"),
  ]);
  const skill = new Map((skills ?? []).map((s) => [s.id, s.name]));
  const preview: HighConfidencePreview = {
    count: (cm ?? []).length + (om ?? []).length, courseLevel: (cm ?? []).length, outcomeLevel: (om ?? []).length,
    courses: new Set([...(cm ?? []), ...(om ?? [])].map((m) => m.course_id)).size,
    sample: (cm ?? []).slice(0, 40).map((m) => ({ course: title.get(m.course_id) ?? "", skill: skill.get(m.skill_id) ?? "", confidence: Number(m.confidence) })),
  };
  if (opts.preview) return { ok: true, preview, confirmed: 0 };
  if (opts.expectedCount !== preview.count) return fail(409, "The list changed since you previewed it. Review it again before confirming.");

  const now = new Date().toISOString();
  const patch = { status: "CONFIRMED", mapping_source: "COLLEGE_CONFIRMED", approved_by: admin.userId, approved_at: now } as const;
  const chunks = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / 200) }, (_, i) => xs.slice(i * 200, i * 200 + 200));
  const results = await Promise.all([
    ...chunks((cm ?? []).map((m) => m.id)).map((c) => service.from("course_skill_mappings").update(patch).in("id", c).eq("status", "SUGGESTED")),
    ...chunks((om ?? []).map((m) => m.id)).map((c) => service.from("course_outcome_skill_mappings").update(patch).in("id", c).eq("status", "SUGGESTED")),
  ]);
  const failed = results.find((r) => r.error);
  return failed?.error ? dbFailure(failed.error, "confirmHighConfidence") : { ok: true, preview, confirmed: preview.count };
}
