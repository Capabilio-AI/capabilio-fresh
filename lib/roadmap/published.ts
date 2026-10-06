import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { officialOnly, type MappingSource, type MappingStatus } from "@/lib/curriculum/mapping-rules";
import type { RoadmapSubject } from "./build";

/**
 * What a student's roadmap may know about their college's curriculum: the PUBLISHED curriculum for their institution + branch
 * (the one for their regulation when it is known, otherwise the most recently published), its live courses, and ONLY official mappings —
 * confirmed by a person, never an AI suggestion. Skills are translated to the role's Arena skill areas through arena_skill_areas.skill_id.
 */
export interface PublishedSubjects {
  subjects: RoadmapSubject[];
  /** a regulation is known and curricula are published for the branch, but none for that regulation */
  regulationMismatch: boolean;
}

const sameRegulation = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export async function loadPublishedSubjects(service: SupabaseClient<Database>, institutionId: string, branchKey: string, roleKey: string, regulation: string | null = null): Promise<PublishedSubjects> {
  const { data: published } = await service
    .from("curriculum_imports")
    .select("id, regulation")
    .eq("institution_id", institutionId)
    .eq("branch_key", branchKey)
    .eq("status", "PUBLISHED")
    .is("deleted_at", null)
    .order("published_at", { ascending: false });
  const list = published ?? [];
  // With a known regulation ONLY that regulation's curriculum counts — a different regulation's subjects would be a wrong roadmap, not a fallback.
  const imp = regulation ? list.find((i) => sameRegulation(i.regulation, regulation)) : list[0];
  if (!imp) return { subjects: [], regulationMismatch: Boolean(regulation) && list.length > 0 };
  const { data: courses } = await service.from("courses").select("id, title, year").eq("import_id", imp.id).is("deleted_at", null);
  const ids = (courses ?? []).map((c) => c.id);
  if (ids.length === 0) return { subjects: [], regulationMismatch: false };

  const [{ data: maps }, { data: areas }] = await Promise.all([
    service.from("course_skill_mappings").select("course_id, skill_id, status, mapping_source").in("course_id", ids),
    service.from("arena_skill_areas").select("area_key, skill_id").eq("role_key", roleKey).not("skill_id", "is", null),
  ]);
  const official = officialOnly((maps ?? []).map((m) => ({ ...m, status: m.status as MappingStatus, source: m.mapping_source as MappingSource })));
  const areasOf = (skillId: string) => (areas ?? []).filter((a) => a.skill_id === skillId).map((a) => a.area_key);
  return {
    regulationMismatch: false,
    subjects: (courses ?? []).map((c) => ({
      id: c.id,
      name: c.title,
      year: c.year,
      areaKeys: [...new Set(official.filter((m) => m.course_id === c.id).flatMap((m) => areasOf(m.skill_id)))],
    })),
  };
}
