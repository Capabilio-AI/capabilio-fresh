import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getOwnedImport } from "./admin-data";
import { statusPath, type ImportStatus } from "./mapping-rules";
import { toTreeJson, type CourseTree } from "./schemas";

type Service = SupabaseClient<Database>;
export type Admin = { userId: string; institutionId: string };
export type Result<T = object> = ({ ok: true } & T) | { ok: false; status: number; message: string };
const fail = (status: number, message: string): { ok: false; status: number; message: string } => ({ ok: false, status, message });

const FROZEN = new Set<string>(["PUBLISHED", "ARCHIVED"]);
export const FROZEN_MESSAGE = "This curriculum is published and can't be edited. Create a new version to make changes.";

/** Database errors with a message written for people (our own raises / constraints) pass through; anything else is generic and logged. */
export function dbFailure(error: { code?: string; message?: string; details?: string }, context: string): { ok: false; status: number; message: string } {
  if (error.code === "23505") return fail(409, "A course with that title already exists in that year.");
  if (error.code === "P0002") return fail(404, "Not found.");
  if (error.code === "23514" && error.message && !/violates check constraint/i.test(error.message)) return fail(409, error.message);
  console.error(`[curriculum] ${context}:`, error.code, error.message, error.details ? `\n${String(error.details).split("\n").slice(0, 6).join("\n")}` : "");
  return fail(500, "Something went wrong. Please try again.");
}

/** A course of the caller's own institution, with its import. Null when it is not theirs, or is removed (unless `allowRemoved`). */
export async function ownedCourse(service: Service, institutionId: string, courseId: string, allowRemoved = false) {
  const { data: course } = await service.from("courses").select("id, import_id, year, title, deleted_at").eq("id", courseId).maybeSingle();
  if (!course || (!allowRemoved && course.deleted_at)) return null;
  const imp = await getOwnedImport(service, institutionId, course.import_id);
  return imp ? { course, imp } : null;
}

export async function createImport(service: Service, admin: Admin, body: { branch: string; regulation?: string | null; program?: string | null }): Promise<Result<{ id: string }>> {
  const { data, error } = await service
    .from("curriculum_imports")
    .insert({ institution_id: admin.institutionId, branch: body.branch, regulation: body.regulation ?? null, program: body.program ?? null, status: "DRAFT", created_by: admin.userId })
    .select("id")
    .single();
  return error || !data ? dbFailure(error ?? {}, "createImport") : { ok: true, id: data.id };
}

export async function updateImport(service: Service, admin: Admin, importId: string, body: { branch?: string; regulation?: string | null; program?: string | null; status?: ImportStatus }): Promise<Result> {
  const imp = await getOwnedImport(service, admin.institutionId, importId);
  if (!imp) return fail(404, "Curriculum not found.");
  if (FROZEN.has(imp.status)) return fail(409, FROZEN_MESSAGE);

  const meta: Database["public"]["Tables"]["curriculum_imports"]["Update"] = {};
  if (body.branch !== undefined) meta.branch = body.branch;
  if (body.regulation !== undefined) meta.regulation = body.regulation;
  if (body.program !== undefined) meta.program = body.program;
  if (Object.keys(meta).length) {
    const { error } = await service.from("curriculum_imports").update(meta).eq("id", importId);
    if (error) return dbFailure(error, "updateImport");
  }
  if (body.status && body.status !== imp.status) {
    const path = statusPath(imp.status as ImportStatus, body.status);
    if (!path) return fail(409, `A curriculum in ${imp.status.toLowerCase().replace("_", " ")} can't move to ${body.status.toLowerCase().replace("_", " ")}.`);
    if (body.status === "CONFIRMED") {
      const { count } = await service.from("courses").select("id", { count: "exact", head: true }).eq("import_id", importId).is("deleted_at", null);
      if (!count) return fail(409, "Add at least one course before confirming.");
    }
    for (const status of path) {
      const { error } = await service.from("curriculum_imports").update({ status, ...(status === "CONFIRMED" ? { reviewed_by: admin.userId } : {}) }).eq("id", importId);
      if (error) return dbFailure(error, "updateImport/status");
    }
  }
  return { ok: true };
}

/** Soft delete: the row stays (recoverable by an operator); it just disappears from every list. A published curriculum is replaced by a new version, never deleted. */
export async function removeImport(service: Service, admin: Admin, importId: string): Promise<Result> {
  const imp = await getOwnedImport(service, admin.institutionId, importId);
  if (!imp) return fail(404, "Curriculum not found.");
  if (FROZEN.has(imp.status)) return fail(409, "A published curriculum can't be deleted. Publish a new version to replace it.");
  const { error } = await service.from("curriculum_imports").update({ deleted_at: new Date().toISOString() }).eq("id", importId);
  return error ? dbFailure(error, "removeImport") : { ok: true };
}

export async function addCourses(
  service: Service,
  admin: Admin,
  importId: string,
  courses: { year: number; semester?: number | null; title: string; code?: string | null; category?: string | null }[]
): Promise<Result<{ added: number; skipped: number }>> {
  const imp = await getOwnedImport(service, admin.institutionId, importId);
  if (!imp) return fail(404, "Curriculum not found.");
  if (FROZEN.has(imp.status)) return fail(409, FROZEN_MESSAGE);

  const { data: live } = await service.from("courses").select("year, title, sort_order").eq("import_id", importId).is("deleted_at", null);
  const key = (year: number, title: string) => `${year}|${title.trim().toLowerCase()}`;
  const seen = new Set((live ?? []).map((c) => key(c.year, c.title)));
  let order = Math.max(-1, ...(live ?? []).map((c) => c.sort_order)) + 1;
  const rows: Database["public"]["Tables"]["courses"]["Insert"][] = [];
  for (const c of courses) {
    if (seen.has(key(c.year, c.title))) continue;
    seen.add(key(c.year, c.title));
    rows.push({ import_id: importId, year: c.year, semester: c.semester ?? null, title: c.title.trim(), course_code: c.code?.trim() || null, category: c.category?.trim() || null, sort_order: order++, is_lab: /\blab(oratory)?\b/i.test(c.title), kind: /\blab(oratory)?\b/i.test(c.title) ? "lab" : "course" });
  }
  if (rows.length) {
    const { error } = await service.from("courses").insert(rows);
    if (error) return dbFailure(error, "addCourses");
  }
  return { ok: true, added: rows.length, skipped: courses.length - rows.length };
}

/** Saves one course and everything under it in a single transaction (replace_course_tree). */
export async function saveCourse(service: Service, admin: Admin, courseId: string, tree: CourseTree): Promise<Result> {
  const owned = await ownedCourse(service, admin.institutionId, courseId);
  if (!owned) return fail(404, "Course not found.");
  if (FROZEN.has(owned.imp.status)) return fail(409, FROZEN_MESSAGE);
  const { error } = await service.rpc("replace_course_tree", { p_course_id: courseId, p_tree: toTreeJson(tree) as never });
  return error ? dbFailure(error, "saveCourse") : { ok: true };
}

export async function setCourseRemoved(service: Service, admin: Admin, courseId: string, removed: boolean): Promise<Result> {
  const owned = await ownedCourse(service, admin.institutionId, courseId, true);
  if (!owned) return fail(404, "Course not found.");
  if (FROZEN.has(owned.imp.status)) return fail(409, FROZEN_MESSAGE);
  const { error } = await service.from("courses").update({ deleted_at: removed ? new Date().toISOString() : null }).eq("id", courseId);
  return error ? dbFailure(error, "setCourseRemoved") : { ok: true };
}

/** Merges `sourceId` into `intoId` (same curriculum). Skill mappings are not carried over. */
export async function mergeCourse(service: Service, admin: Admin, sourceId: string, intoId: string): Promise<Result> {
  const [a, b] = await Promise.all([ownedCourse(service, admin.institutionId, sourceId), ownedCourse(service, admin.institutionId, intoId)]);
  if (!a || !b) return fail(404, "Course not found.");
  if (a.imp.id !== b.imp.id) return fail(400, "Courses must be in the same curriculum.");
  if (FROZEN.has(a.imp.status)) return fail(409, FROZEN_MESSAGE);
  const { error } = await service.rpc("merge_courses", { p_source: sourceId, p_target: intoId });
  return error ? dbFailure(error, "mergeCourse") : { ok: true };
}

/** Publishes a CONFIRMED import: version row + status + archive of the version it replaces, atomically (publish_curriculum_import). */
export async function publishImport(service: Service, admin: Admin, importId: string): Promise<Result<{ versionId: string }>> {
  const imp = await getOwnedImport(service, admin.institutionId, importId);
  if (!imp) return fail(404, "Curriculum not found.");
  if (imp.status !== "CONFIRMED") return fail(409, imp.status === "PUBLISHED" ? "This curriculum is already published." : "Confirm the curriculum before publishing it.");
  const { data, error } = await service.rpc("publish_curriculum_import", { p_import_id: importId, p_user_id: admin.userId });
  return error || !data ? dbFailure(error ?? {}, "publishImport") : { ok: true, versionId: data };
}

/** Copies a PUBLISHED curriculum into a new editable version (clone_curriculum_import): the way to correct something that is frozen. */
export async function createNewVersion(service: Service, admin: Admin, importId: string): Promise<Result<{ id: string }>> {
  const imp = await getOwnedImport(service, admin.institutionId, importId);
  if (!imp) return fail(404, "Curriculum not found.");
  if (imp.status !== "PUBLISHED") return fail(409, "Only a published curriculum can be copied into a new version.");
  const { data, error } = await service.rpc("clone_curriculum_import", { p_import_id: importId, p_user_id: admin.userId });
  return error || !data ? dbFailure(error ?? {}, "createNewVersion") : { ok: true, id: data };
}
