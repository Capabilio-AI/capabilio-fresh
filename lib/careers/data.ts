import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { officialOnly, type MappingImportance, type MappingSource, type MappingStatus } from "@/lib/curriculum/mapping-rules";
import { rankCareersForCourse, rankCoursesForCareer, type CareerWithRequirements, type CourseSkill, type RequirementImportance } from "./relevance";

type Service = SupabaseClient<Database>;

export interface Career extends CareerWithRequirements {
  key: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
}

/** Careers with their canonical skill requirements. Read-only; the catalog is maintained by operators. */
export async function loadCareers(service: Service, opts: { activeOnly?: boolean } = {}): Promise<Career[]> {
  const q = service.from("careers").select("id, key, name, category, description, is_active").order("name");
  const [{ data: careers }, { data: reqs }] = await Promise.all([opts.activeOnly === false ? q : q.eq("is_active", true), service.from("career_skill_requirements").select("career_id, skill_id, importance, target_level")]);
  return (careers ?? []).map((c) => ({
    id: c.id, key: c.key, name: c.name, category: c.category, description: c.description, isActive: c.is_active,
    requirements: (reqs ?? []).filter((r) => r.career_id === c.id).map((r) => ({ skillId: r.skill_id, importance: r.importance as RequirementImportance, targetLevel: r.target_level })),
  }));
}

/** Official skills per course: CONFIRMED by a person, never an AI suggestion. */
export async function loadOfficialCourseSkills(service: Service, courseIds: string[]): Promise<Map<string, CourseSkill[]>> {
  const out = new Map<string, CourseSkill[]>();
  if (courseIds.length === 0) return out;
  const { data } = await service.from("course_skill_mappings").select("course_id, skill_id, importance, status, mapping_source").in("course_id", courseIds);
  const rows = officialOnly((data ?? []).map((m) => ({ ...m, status: m.status as MappingStatus, source: m.mapping_source as MappingSource })));
  for (const m of rows) out.set(m.course_id, [...(out.get(m.course_id) ?? []), { skillId: m.skill_id, importance: m.importance as MappingImportance | null }]);
  return out;
}

export async function loadSkillNames(service: Service): Promise<Map<string, string>> {
  const { data } = await service.from("skills").select("id, name");
  return new Map((data ?? []).map((s) => [s.id, s.name]));
}

/** Relevance of one course to every career (for the course page). */
export async function loadCourseRelevance(service: Service, courseId: string) {
  const [careers, skills, names] = await Promise.all([loadCareers(service), loadOfficialCourseSkills(service, [courseId]), loadSkillNames(service)]);
  const courseSkills = skills.get(courseId) ?? [];
  return { configured: careers.some((c) => c.requirements.length > 0), confirmedSkills: courseSkills.length, ranked: rankCareersForCourse(courseSkills, careers.filter((c) => c.requirements.length > 0)), names };
}

/** For every career, the courses of one curriculum ranked by relevance (for the wizard step). */
export async function loadImportRelevance(service: Service, courses: { id: string; title: string; year: number }[]) {
  const [careers, skills, names] = await Promise.all([loadCareers(service), loadOfficialCourseSkills(service, courses.map((c) => c.id)), loadSkillNames(service)]);
  const withReqs = careers.filter((c) => c.requirements.length > 0);
  const titleOf = new Map(courses.map((c) => [c.id, c]));
  return {
    configured: withReqs.length > 0,
    coursesWithConfirmedSkills: courses.filter((c) => (skills.get(c.id) ?? []).length > 0).length,
    careers: withReqs.map((career) => ({
      career,
      ranked: rankCoursesForCareer(career.requirements, courses.map((c) => ({ id: c.id, skills: skills.get(c.id) ?? [] }))).map((r) => ({ ...r, title: titleOf.get(r.courseId)!.title, year: titleOf.get(r.courseId)!.year })),
    })),
    names,
  };
}
