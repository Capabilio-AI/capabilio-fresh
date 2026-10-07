import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentDirection, needsYearConfirmation } from "@/lib/career/direction";
import { DEFAULT_ACADEMIC_START_MONTH } from "@/lib/career/academic-year";
import { getCareerIntent } from "@/lib/careers/intent";
import { loadCareers, type Career } from "@/lib/careers/data";
import { loadStudentCapabilities } from "@/lib/capability/read-model";
import { loadArenaChallengesForSkills, loadCertifications, loadLearningCatalog, loadProjects } from "@/lib/catalog/data";
import { loadPublishedCurriculum } from "./curriculum";
import { estimateSemester, totalYearsOf } from "./position";
import { rankCareersForExploration } from "./explore";
import { computeReadiness } from "./readiness";
import type { CareerRequirement, EngineInput, StudentSkillInput } from "./types";

type Service = SupabaseClient<Database>;

export type GoalKind = "PRIMARY" | "PLAN_B" | "EXPLORING_ALT";
export interface LoadedMeta {
  mode: "STANDARD" | "EXPLORING";
  institutionId: string;
  branchKey: string;
  regulation: string | null;
  curriculumVersionId: string | null;
  goals: { kind: GoalKind; careerId: string; careerName: string; readiness: number }[];
  /** the semester is estimated from the calendar, not recorded */
  semesterEstimated: true;
  /** capability records whose skill name did not resolve to the canonical catalog */
  unmatchedCapabilities: string[];
  /** every skill name in the catalog — used to check AI prose never mentions a skill outside its facts */
  allSkillNames: string[];
}

/** What is missing, and so what the student can do about it. Never a fabricated roadmap. */
export type LoadResult =
  | { status: "MISSING_ACADEMIC_POSITION"; reason: "no_membership" | "year_unknown" }
  | { status: "MISSING_CURRICULUM"; reason: "none" | "regulation"; regulation: string | null }
  | { status: "MISSING_CAREER_GOAL" }
  | { status: "MISSING_CAREER_REQUIREMENTS"; careerName: string }
  | { status: "READY"; input: EngineInput; meta: LoadedMeta };

const toInput = (c: { level: number | null; confidence: number; verified: boolean; verifiedLevel: number | null; selfDeclaredLevel: number | null }): StudentSkillInput => ({ level: c.level ?? 0, assessed: c.level !== null, confidence: c.confidence, verified: c.verified, verifiedLevel: c.verifiedLevel, selfDeclaredLevel: c.selfDeclaredLevel });

async function requirementsOf(service: Service, careers: Career[]): Promise<Map<string, CareerRequirement[]>> {
  const ids = [...new Set(careers.flatMap((c) => c.requirements.map((r) => r.skillId)))];
  const { data: skills } = ids.length ? await service.from("skills").select("id, name, parent_skill_id").in("id", ids) : { data: [] as { id: string; name: string; parent_skill_id: string | null }[] };
  const info = new Map((skills ?? []).map((s) => [s.id, s]));
  const stages = ids.length ? (await service.from("career_skill_requirements").select("career_id, skill_id, required_by_stage").in("skill_id", ids)).data ?? [] : [];
  const stageOf = new Map(stages.map((s) => [`${s.career_id}|${s.skill_id}`, s.required_by_stage as CareerRequirement["stage"]]));
  return new Map(careers.map((c) => [c.id, c.requirements.map((r): CareerRequirement => ({ skillId: r.skillId, skillName: info.get(r.skillId)?.name ?? "Unknown skill", importance: r.importance, targetLevel: r.targetLevel, stage: stageOf.get(`${c.id}|${r.skillId}`) ?? "JOB_READY", parentSkillId: info.get(r.skillId)?.parent_skill_id ?? null }))]));
}

/**
 * Assembles everything the generator needs from real, stored data (reads only), or says exactly what is missing. Applies to every track
 * that has a career goal. Order of the checks is the order a student would fix them in.
 */
export async function loadRoadmapContext(service: Service, userId: string, now: Date = new Date()): Promise<LoadResult> {
  const direction = await getStudentDirection(service, userId, now);
  if (!direction || !direction.institutionId || !direction.branch) return { status: "MISSING_ACADEMIC_POSITION", reason: "no_membership" };
  const year = needsYearConfirmation(direction, now) ? null : direction.academicYear?.year ?? null;
  if (year == null) return { status: "MISSING_ACADEMIC_POSITION", reason: "year_unknown" };

  const branchKey = direction.branch.trim().toLowerCase();
  const [{ data: institution }, curriculum] = await Promise.all([
    service.from("institutions").select("academic_start_month").eq("id", direction.institutionId).maybeSingle(),
    loadPublishedCurriculum(service, direction.institutionId, branchKey, direction.regulation),
  ]);
  if (!curriculum.found) return { status: "MISSING_CURRICULUM", reason: curriculum.regulationMismatch ? "regulation" : "none", regulation: direction.regulation };

  const { intent } = await getCareerIntent(service, userId);
  const careers = (await loadCareers(service)).filter((c) => c.requirements.length > 0);
  const reqs = await requirementsOf(service, careers);
  const caps = await loadStudentCapabilities(service, userId);
  const capability: Record<string, StudentSkillInput> = Object.fromEntries([...caps.bySkill].map(([id, c]) => [id, toInput(c)]));
  const courseSkills = curriculum.courses.map((c) => ({ skills: c.skills.map((s) => ({ skillId: s.skillId, importance: s.importance })) }));

  let primary = intent.primary ? careers.find((c) => c.id === intent.primary!.id) ?? null : null;
  let mode: LoadedMeta["mode"] = "STANDARD";
  const goals: LoadedMeta["goals"] = [];
  if (!primary) {
    if (intent.primary) return { status: "MISSING_CAREER_REQUIREMENTS", careerName: intent.primary.name };
    if (!intent.isExploring) return { status: "MISSING_CAREER_GOAL" };
    const ranked = rankCareersForExploration(careers.map((c) => ({ id: c.id, name: c.name, requirements: c.requirements })), capability, courseSkills);
    if (ranked.length === 0) return { status: "MISSING_CAREER_GOAL" };
    mode = "EXPLORING";
    primary = careers.find((c) => c.id === ranked[0].careerId)!;
    ranked.slice(0, 3).forEach((r, i) => goals.push({ kind: i === 0 ? "PRIMARY" : "EXPLORING_ALT", careerId: r.careerId, careerName: r.careerName, readiness: r.score }));
  } else {
    goals.push({ kind: "PRIMARY", careerId: primary.id, careerName: primary.name, readiness: computeReadiness(reqs.get(primary.id)!, capability) });
    const planB = intent.secondary ? careers.find((c) => c.id === intent.secondary!.id) : undefined;
    if (planB) goals.push({ kind: "PLAN_B", careerId: planB.id, careerName: planB.name, readiness: computeReadiness(reqs.get(planB.id)!, capability) });
  }

  const requirements = reqs.get(primary.id)!;
  const requiredSkillIds = requirements.map((r) => r.skillId);
  const [learning, certifications, projects, arena, { data: allSkills }] = await Promise.all([
    loadLearningCatalog(service), loadCertifications(service), loadProjects(service, { studentId: userId, institutionId: direction.institutionId }),
    loadArenaChallengesForSkills(service, requiredSkillIds), service.from("skills").select("name").eq("status", "active"),
  ]);

  return {
    status: "READY",
    input: {
      career: { id: primary.id, name: primary.name }, requirements, courses: curriculum.courses, capability, hasAnyCapabilityData: caps.bySkill.size > 0,
      position: { year, semester: estimateSemester(now, (institution?.academic_start_month ?? DEFAULT_ACADEMIC_START_MONTH)), totalYears: totalYearsOf(direction.startYear, direction.endYear) },
      student: { id: userId, institutionId: direction.institutionId }, catalogs: { learning, certifications, projects, arena },
    },
    meta: {
      mode, institutionId: direction.institutionId, branchKey, regulation: curriculum.regulation, curriculumVersionId: curriculum.curriculumVersionId, goals,
      semesterEstimated: true, unmatchedCapabilities: caps.unmatched, allSkillNames: (allSkills ?? []).map((s) => s.name),
    },
  };
}
