import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ArenaChallengeItem, CertificationItem, CertRelevance, Difficulty, LearningItem, ProjectItem } from "./match";

type Service = SupabaseClient<Database>;
const group = <T extends Record<string, string>>(rows: T[] | null, key: keyof T, value: keyof T) => {
  const m = new Map<string, string[]>();
  for (const r of rows ?? []) m.set(r[key], [...(m.get(r[key]) ?? []), r[value]]);
  return m;
};

/** Active learning resources configured by an operator. Empty until some are configured — and the caller says so. */
export async function loadLearningCatalog(service: Service): Promise<LearningItem[]> {
  const [{ data: items }, { data: skills }] = await Promise.all([service.from("learning_catalog").select("*").eq("is_active", true), service.from("learning_item_skills").select("item_id, skill_id")]);
  const skillsOf = group(skills, "item_id", "skill_id");
  return (items ?? []).map((i) => ({ id: i.id, title: i.title, provider: i.provider, url: i.url, levelFrom: i.level_from, levelTo: i.level_to, estimatedHours: i.estimated_hours == null ? null : Number(i.estimated_hours), prerequisites: i.prerequisites, skillIds: skillsOf.get(i.id) ?? [] }));
}

export async function loadCertifications(service: Service): Promise<CertificationItem[]> {
  const [{ data: certs }, { data: skills }, { data: careers }] = await Promise.all([
    service.from("certification_catalog").select("*").eq("is_active", true),
    service.from("certification_skills").select("certification_id, skill_id"),
    service.from("certification_careers").select("certification_id, career_id, relevance"),
  ]);
  const skillsOf = group(skills, "certification_id", "skill_id");
  return (certs ?? []).map((c) => ({
    id: c.id, name: c.name, provider: c.provider, difficulty: c.difficulty as Difficulty | null, url: c.url, cost: c.cost, duration: c.duration, eligibility: c.eligibility,
    skillIds: skillsOf.get(c.id) ?? [],
    careers: (careers ?? []).filter((x) => x.certification_id === c.id).map((x) => ({ careerId: x.career_id, relevance: x.relevance as CertRelevance })),
  }));
}

/** Everything a given student may be offered: live general projects, their own college's, and AI recommendations made for them. */
export async function loadProjects(service: Service, ctx: { studentId: string; institutionId: string | null }): Promise<ProjectItem[]> {
  const mine = [`and(status.eq.ACTIVE,source.in.(CAPABILIO,MENTOR))`, `and(status.eq.RECOMMENDATION,for_student_id.eq.${ctx.studentId})`, ...(ctx.institutionId ? [`and(status.eq.ACTIVE,source.eq.COLLEGE,institution_id.eq.${ctx.institutionId})`] : [])];
  const [{ data: projects }, { data: skills }] = await Promise.all([service.from("project_catalog").select("*").or(mine.join(",")), service.from("project_skills").select("project_id, skill_id")]);
  const skillsOf = group(skills, "project_id", "skill_id");
  return (projects ?? []).map((p) => ({
    id: p.id, title: p.title, description: p.description, difficulty: p.difficulty as Difficulty, expectedEvidence: p.expected_evidence, source: p.source as ProjectItem["source"], status: p.status as ProjectItem["status"],
    institutionId: p.institution_id, forStudentId: p.for_student_id, skillIds: skillsOf.get(p.id) ?? [],
  }));
}

/** Active Arena challenges tagged with any of the given canonical skills. */
export async function loadArenaChallengesForSkills(service: Service, skillIds: string[]): Promise<ArenaChallengeItem[]> {
  if (skillIds.length === 0) return [];
  const { data: tags } = await service.from("arena_challenge_skills").select("challenge_id, skill_id").in("skill_id", skillIds);
  const ids = [...new Set((tags ?? []).map((t) => t.challenge_id))];
  if (ids.length === 0) return [];
  // every tag of a matched challenge, not just the requested ones: how focused a challenge is depends on what else it teaches
  const [{ data: challenges }, { data: allTags }] = await Promise.all([
    service.from("arena_challenges").select("id, title, difficulty, active").in("id", ids),
    service.from("arena_challenge_skills").select("challenge_id, skill_id").in("challenge_id", ids),
  ]);
  const skillsOf = group(allTags ?? tags, "challenge_id", "skill_id");
  return (challenges ?? []).map((c) => ({ id: c.id, title: c.title, difficulty: c.difficulty, active: c.active, skillIds: skillsOf.get(c.id) ?? [] }));
}

export const MAX_AI_RECOMMENDATIONS_PER_STUDENT = 20;

/**
 * An AI-generated project is stored ONLY as a RECOMMENDATION for the one student it was made for (the database refuses any other
 * shape). Completing it later is what creates evidence — recording it here changes no capability.
 */
export async function saveAiProjectRecommendation(
  service: Service,
  studentId: string,
  rec: { title: string; description: string; difficulty: Difficulty; expectedEvidence: string[]; skillIds: string[] }
): Promise<{ ok: true; id: string } | { ok: false; status: number; message: string }> {
  const { count } = await service.from("project_catalog").select("id", { count: "exact", head: true }).eq("for_student_id", studentId).eq("status", "RECOMMENDATION");
  if ((count ?? 0) >= MAX_AI_RECOMMENDATIONS_PER_STUDENT) return { ok: false, status: 409, message: "You already have a lot of suggested projects. Finish or dismiss some first." };
  const { data, error } = await service
    .from("project_catalog")
    .insert({ title: rec.title, description: rec.description, difficulty: rec.difficulty, expected_evidence: rec.expectedEvidence, source: "AI_GENERATED", status: "RECOMMENDATION", for_student_id: studentId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, status: 500, message: "Something went wrong. Please try again." };
  if (rec.skillIds.length) {
    const { error: skillError } = await service.from("project_skills").insert(rec.skillIds.map((skill_id) => ({ project_id: data.id, skill_id })));
    if (skillError) {
      await service.from("project_catalog").delete().eq("id", data.id);
      return { ok: false, status: 400, message: "A project can only be tied to skills from the catalog." };
    }
  }
  return { ok: true, id: data.id };
}
