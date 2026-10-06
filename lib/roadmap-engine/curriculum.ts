import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { officialOnly, type MappingImportance, type MappingSource, type MappingStatus } from "@/lib/curriculum/mapping-rules";
import type { CourseInput } from "./types";

type Service = SupabaseClient<Database>;
const same = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export type PublishedCurriculum =
  | { found: true; importId: string; curriculumVersionId: string | null; regulation: string | null; courses: CourseInput[] }
  | { found: false; regulationMismatch: boolean };

/**
 * The PUBLISHED curriculum a student's roadmap is built from: their institution + branch, and — when their regulation is known — only THAT
 * regulation's (never a different one). Courses are the live ones with their OFFICIAL skills (confirmed by a person, never an AI suggestion)
 * and how many confirmed outcomes back each skill.
 */
export async function loadPublishedCurriculum(service: Service, institutionId: string, branchKey: string, regulation: string | null): Promise<PublishedCurriculum> {
  const { data: published } = await service.from("curriculum_imports").select("id, regulation").eq("institution_id", institutionId).eq("branch_key", branchKey).eq("status", "PUBLISHED").is("deleted_at", null).order("published_at", { ascending: false });
  const list = published ?? [];
  const imp = regulation ? list.find((i) => same(i.regulation, regulation)) : list[0];
  if (!imp) return { found: false, regulationMismatch: Boolean(regulation) && list.length > 0 };

  const [{ data: courses }, { data: version }] = await Promise.all([
    service.from("courses").select("id, title, year, semester, prerequisite_course_ids").eq("import_id", imp.id).is("deleted_at", null).order("sort_order"),
    service.from("curriculum_versions").select("id").eq("import_id", imp.id).maybeSingle(),
  ]);
  const ids = (courses ?? []).map((c) => c.id);
  if (ids.length === 0) return { found: false, regulationMismatch: false };
  const [{ data: maps }, { data: omaps }] = await Promise.all([
    service.from("course_skill_mappings").select("course_id, skill_id, importance, status, mapping_source").in("course_id", ids),
    service.from("course_outcome_skill_mappings").select("course_id, skill_id, status, mapping_source").in("course_id", ids),
  ]);
  const official = <T extends { status: string; mapping_source: string }>(rows: T[] | null) => officialOnly((rows ?? []).map((m) => ({ ...m, status: m.status as MappingStatus, source: m.mapping_source as MappingSource })));
  const courseMaps = official(maps);
  const outcomeMaps = official(omaps);
  return {
    found: true, importId: imp.id, curriculumVersionId: version?.id ?? null, regulation: imp.regulation,
    courses: (courses ?? []).map((c) => ({
      id: c.id, title: c.title, year: c.year, semester: c.semester, prerequisiteCourseIds: c.prerequisite_course_ids,
      skills: courseMaps.filter((m) => m.course_id === c.id).map((m) => ({ skillId: m.skill_id, importance: m.importance as MappingImportance | null, outcomeCount: outcomeMaps.filter((o) => o.course_id === c.id && o.skill_id === m.skill_id).length })),
    })),
  };
}
