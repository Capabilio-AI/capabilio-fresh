import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { officialOnly, type MappingSource, type MappingStatus } from "@/lib/curriculum/mapping-rules";
import type { RoadmapSubject } from "./build";

/**
 * What a student's roadmap may know about their college's curriculum: the PUBLISHED curriculum for their institution + branch
 * (the most recently published one, until students are matched to a regulation), its live courses, and ONLY official mappings —
 * confirmed by a person, never an AI suggestion. Skills are translated to the role's Arena skill areas through arena_skill_areas.skill_id.
 */
export async function loadPublishedSubjects(service: SupabaseClient<Database>, institutionId: string, branchKey: string, roleKey: string): Promise<RoadmapSubject[]> {
  const { data: imp } = await service
    .from("curriculum_imports")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("branch_key", branchKey)
    .eq("status", "PUBLISHED")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!imp) return [];
  const { data: courses } = await service.from("courses").select("id, title, year").eq("import_id", imp.id).is("deleted_at", null);
  const ids = (courses ?? []).map((c) => c.id);
  if (ids.length === 0) return [];

  const [{ data: maps }, { data: areas }] = await Promise.all([
    service.from("course_skill_mappings").select("course_id, skill_id, status, mapping_source").in("course_id", ids),
    service.from("arena_skill_areas").select("area_key, skill_id").eq("role_key", roleKey).not("skill_id", "is", null),
  ]);
  const official = officialOnly((maps ?? []).map((m) => ({ ...m, status: m.status as MappingStatus, source: m.mapping_source as MappingSource })));
  const areasOf = (skillId: string) => (areas ?? []).filter((a) => a.skill_id === skillId).map((a) => a.area_key);
  return (courses ?? []).map((c) => ({
    id: c.id,
    name: c.title,
    year: c.year,
    areaKeys: [...new Set(official.filter((m) => m.course_id === c.id).flatMap((m) => areasOf(m.skill_id)))],
  }));
}
