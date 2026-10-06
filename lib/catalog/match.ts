/**
 * What the roadmap may RECOMMEND, chosen from the configured catalogs only — PURE and deterministic (no database, no AI). Every function
 * takes the catalog it may draw from; nothing outside it can be returned, and "nothing configured" is simply an empty result the caller states honestly.
 */
export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type CertRelevance = "REQUIRED" | "RECOMMENDED" | "OPTIONAL";

export interface LearningItem {
  id: string;
  title: string;
  provider: string;
  url: string | null;
  levelFrom: number;
  levelTo: number;
  estimatedHours: number | null;
  prerequisites: string[];
  skillIds: string[];
}
export interface CertificationItem {
  id: string;
  name: string;
  provider: string;
  difficulty: Difficulty | null;
  url: string | null;
  cost: string | null;
  duration: string | null;
  eligibility: string | null;
  skillIds: string[];
  careers: { careerId: string; relevance: CertRelevance }[];
}
export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  expectedEvidence: string[];
  source: "CAPABILIO" | "COLLEGE" | "MENTOR" | "AI_GENERATED";
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | "RECOMMENDATION";
  institutionId: string | null;
  forStudentId: string | null;
  skillIds: string[];
}
export interface ArenaChallengeItem {
  id: string;
  title: string;
  difficulty: string;
  skillIds: string[];
  active: boolean;
}

const hours = (h: number | null) => h ?? Number.POSITIVE_INFINITY;

export interface LearningRecommendation {
  item: LearningItem;
  /** the student's current level is inside the resource's range, so they can begin it today */
  startsNow: boolean;
  reachesTarget: boolean;
  /** how many level points of the student's gap the resource covers */
  progress: number;
  reason: string;
}

/**
 * Resources that teach `skillId` and cover part of the gap between where the student is and where the career needs them. Best first: can start
 * today, then reaches the target, then moves the student furthest, then the shorter one.
 */
export function recommendLearning(skillId: string, currentLevel: number, targetLevel: number, items: LearningItem[], limit = 3): LearningRecommendation[] {
  if (currentLevel >= targetLevel) return [];
  return items
    .filter((i) => i.skillIds.includes(skillId) && i.levelTo > currentLevel && i.levelFrom < targetLevel)
    .map((item) => {
      const startsNow = item.levelFrom <= currentLevel;
      const reachesTarget = item.levelTo >= targetLevel;
      const progress = Math.max(0, Math.min(item.levelTo, targetLevel) - Math.max(item.levelFrom, currentLevel));
      return { item, startsNow, reachesTarget, progress, reason: `Takes you from ${item.levelFrom} to ${item.levelTo} on this skill; you're at ${currentLevel} and the career asks for ${targetLevel}.` };
    })
    .sort((a, b) => Number(b.startsNow) - Number(a.startsNow) || Number(b.reachesTarget) - Number(a.reachesTarget) || b.progress - a.progress || hours(a.item.estimatedHours) - hours(b.item.estimatedHours) || a.item.title.localeCompare(b.item.title))
    .slice(0, limit);
}

const RELEVANCE_ORDER: Record<CertRelevance, number> = { REQUIRED: 0, RECOMMENDED: 1, OPTIONAL: 2 };

/** Certifications an operator has configured for THIS career that cover a skill the student still needs. The label is the stored one. */
export function recommendCertifications(careerId: string | null, gapSkillIds: string[], certs: CertificationItem[]) {
  if (!careerId || gapSkillIds.length === 0) return [];
  const gaps = new Set(gapSkillIds);
  return certs
    .flatMap((cert) => {
      const link = cert.careers.find((c) => c.careerId === careerId);
      const coveredSkillIds = cert.skillIds.filter((s) => gaps.has(s));
      return link && coveredSkillIds.length > 0 ? [{ cert, relevance: link.relevance, coveredSkillIds }] : [];
    })
    .sort((a, b) => RELEVANCE_ORDER[a.relevance] - RELEVANCE_ORDER[b.relevance] || b.coveredSkillIds.length - a.coveredSkillIds.length || a.cert.name.localeCompare(b.cert.name));
}

const DIFFICULTY_ORDER: Record<Difficulty, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };

/**
 * Projects a student may be offered: live general projects, their OWN college's projects, and AI recommendations made for THEM
 * (a recommendation is never a live catalog entry). Ranked by how many of their gaps they address, then easiest first.
 */
export function recommendProjects(gapSkillIds: string[], projects: ProjectItem[], ctx: { studentId: string; institutionId: string | null; maxDifficulty?: Difficulty }) {
  const gaps = new Set(gapSkillIds);
  const max = ctx.maxDifficulty ? DIFFICULTY_ORDER[ctx.maxDifficulty] : 2;
  const visible = (p: ProjectItem) =>
    p.source === "AI_GENERATED" ? p.status === "RECOMMENDATION" && p.forStudentId === ctx.studentId
    : p.status === "ACTIVE" && (p.source !== "COLLEGE" || (p.institutionId !== null && p.institutionId === ctx.institutionId));
  return projects
    .filter((p) => visible(p) && DIFFICULTY_ORDER[p.difficulty] <= max)
    .flatMap((project) => {
      const coveredSkillIds = project.skillIds.filter((s) => gaps.has(s));
      return coveredSkillIds.length > 0 ? [{ project, coveredSkillIds, isAiRecommendation: project.source === "AI_GENERATED" }] : [];
    })
    .sort((a, b) => b.coveredSkillIds.length - a.coveredSkillIds.length || DIFFICULTY_ORDER[a.project.difficulty] - DIFFICULTY_ORDER[b.project.difficulty] || a.project.title.localeCompare(b.project.title));
}

const ARENA_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/** Arena challenges tagged with a skill the student still needs, nearest the wanted difficulty first. */
export function recommendArena(gapSkillIds: string[], challenges: ArenaChallengeItem[], wantedDifficulty: string, limit = 5) {
  const gaps = new Set(gapSkillIds);
  const want = ARENA_ORDER[wantedDifficulty] ?? 1;
  return challenges
    .filter((c) => c.active)
    .flatMap((challenge) => {
      const coveredSkillIds = challenge.skillIds.filter((s) => gaps.has(s));
      return coveredSkillIds.length > 0 ? [{ challenge, coveredSkillIds }] : [];
    })
    .sort((a, b) => Math.abs((ARENA_ORDER[a.challenge.difficulty] ?? 1) - want) - Math.abs((ARENA_ORDER[b.challenge.difficulty] ?? 1) - want) || b.coveredSkillIds.length - a.coveredSkillIds.length || a.challenge.id.localeCompare(b.challenge.id))
    .slice(0, limit);
}
