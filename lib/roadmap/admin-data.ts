import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface AdminSubject {
  id: string;
  branch: string;
  year: number;
  semester: number | null;
  name: string;
  code: string | null;
  mappedAreaKeys: string[];
}

/** All subjects for one institution with their confirmed mappings for one role. Service-role read, after the caller was authorised. */
export async function listSubjectsForAdmin(service: SupabaseClient<Database>, institutionId: string, roleKey: string): Promise<AdminSubject[]> {
  const { data: subjects } = await service
    .from("curriculum_subjects")
    .select("id, branch, year, semester, name, code")
    .eq("institution_id", institutionId)
    .order("branch")
    .order("year")
    .order("name");
  const ids = (subjects ?? []).map((s) => s.id);
  const { data: maps } = ids.length
    ? await service.from("curriculum_subject_skill_map").select("subject_id, area_key").eq("role_key", roleKey).in("subject_id", ids)
    : { data: [] as { subject_id: string; area_key: string }[] };
  return (subjects ?? []).map((s) => ({ ...s, mappedAreaKeys: (maps ?? []).filter((m) => m.subject_id === s.id).map((m) => m.area_key) }));
}
