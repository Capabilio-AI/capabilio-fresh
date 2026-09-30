import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SubjectsBody } from "./schemas";

type Service = SupabaseClient<Database>;
export type WriteResult = { ok: true; count?: number; subjects?: { name: string; id: string }[] } | { ok: false; status: number; message: string };

/** Adds subjects for the admin's own institution; a duplicate (same branch/year/name) is skipped, not duplicated. */
export async function addSubjects(service: Service, admin: { userId: string; institutionId: string }, body: SubjectsBody): Promise<WriteResult> {
  const rows = body.subjects.map((s) => ({
    institution_id: admin.institutionId,
    branch: body.branch.trim(),
    year: body.year,
    semester: body.semester ?? null,
    name: s.name.trim(),
    code: s.code?.trim() || null,
    created_by: admin.userId,
  }));
  // The uniqueness rule is an expression index (lower/btrim), so duplicates surface as 23505 and are skipped.
  return insertSkippingDuplicates(service, rows);
}

async function insertSkippingDuplicates(service: Service, rows: Database["public"]["Tables"]["curriculum_subjects"]["Insert"][]): Promise<WriteResult> {
  const subjects: { name: string; id: string }[] = [];
  for (const row of rows) {
    const { data, error } = await service.from("curriculum_subjects").insert(row).select("id").single();
    if (!error && data) subjects.push({ name: row.name, id: data.id });
    else if (error?.code !== "23505") return { ok: false, status: 500, message: "Could not save subjects." };
  }
  return { ok: true, count: subjects.length, subjects };
}

async function ownedSubject(service: Service, institutionId: string, subjectId: string) {
  const { data } = await service.from("curriculum_subjects").select("id").eq("id", subjectId).eq("institution_id", institutionId).maybeSingle();
  return Boolean(data);
}

export async function deleteSubject(service: Service, institutionId: string, subjectId: string): Promise<WriteResult> {
  if (!(await ownedSubject(service, institutionId, subjectId))) return { ok: false, status: 404, message: "Subject not found." };
  const { error } = await service.from("curriculum_subjects").delete().eq("id", subjectId).eq("institution_id", institutionId);
  return error ? { ok: false, status: 500, message: "Could not delete." } : { ok: true };
}

/**
 * Replaces a subject's mapping for one role with exactly what the admin confirmed. Only skill areas
 * that exist for that role are accepted. `fromSuggestion` records provenance only — the admin's
 * explicit confirmation is what writes.
 */
export async function setMapping(
  service: Service,
  admin: { userId: string; institutionId: string },
  subjectId: string,
  roleKey: string,
  areaKeys: string[],
  fromSuggestion: boolean
): Promise<WriteResult> {
  if (!(await ownedSubject(service, admin.institutionId, subjectId))) return { ok: false, status: 404, message: "Subject not found." };
  const { data: areas } = await service.from("arena_skill_areas").select("area_key").eq("role_key", roleKey);
  const valid = new Set((areas ?? []).map((a) => a.area_key));
  const unique = [...new Set(areaKeys)];
  if (unique.some((k) => !valid.has(k))) return { ok: false, status: 400, message: "Unknown skill area." };

  const { error: delError } = await service.from("curriculum_subject_skill_map").delete().eq("subject_id", subjectId).eq("role_key", roleKey);
  if (delError) return { ok: false, status: 500, message: "Could not save mapping." };
  if (unique.length === 0) return { ok: true, count: 0 };
  const { error } = await service.from("curriculum_subject_skill_map").insert(
    unique.map((area_key) => ({
      subject_id: subjectId,
      role_key: roleKey,
      area_key,
      source: fromSuggestion ? "ai_suggestion_confirmed" : "admin",
      confirmed_by: admin.userId,
    }))
  );
  return error ? { ok: false, status: 500, message: "Could not save mapping." } : { ok: true, count: unique.length };
}
