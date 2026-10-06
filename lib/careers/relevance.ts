/**
 * Course -> career relevance, PURE and deterministic (no AI, no database). It answers: "of everything this career asks for, how much does this
 * course's CONFIRMED skill set cover?". Only official (person-confirmed) skills may be passed in; this function never sees an AI suggestion.
 *
 *   demand       = Σ over the career's requirements of  weight(importance) × targetLevel/100
 *   contribution = weight(requirement importance) × targetLevel/100 × strength(how strongly the course teaches the skill)
 *   score        = Σ contributions / demand                      (0..1)
 *
 * The weights and thresholds below are product defaults — change them here, in one place, and the tests state what they mean.
 */
import type { MappingImportance } from "@/lib/curriculum/mapping-rules";

export type RequirementImportance = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Relevance = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface Requirement {
  skillId: string;
  importance: RequirementImportance;
  /** 0–100 */
  targetLevel: number;
}
export interface CourseSkill {
  skillId: string;
  /** how strongly the course teaches it; null = the college has not graded it, treated as SUPPORTING */
  importance: MappingImportance | null;
}
export interface RelevanceMatch {
  skillId: string;
  requirement: RequirementImportance;
  mapping: MappingImportance;
  contribution: number;
}
export interface CourseRelevance {
  score: number;
  label: Relevance;
  /** the career's total weighted demand (the denominator) */
  demand: number;
  matches: RelevanceMatch[];
}

export const REQUIREMENT_WEIGHT: Record<RequirementImportance, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
export const MAPPING_STRENGTH: Record<MappingImportance, number> = { CORE: 1, SUPPORTING: 0.6, MINOR: 0.3 };
/** A single course covering ≥ 20% of a career's weighted demand is HIGH; ≥ 8% MEDIUM; any overlap is LOW. */
export const RELEVANCE_THRESHOLDS = { high: 0.2, medium: 0.08 } as const;

const labelFor = (score: number): Relevance => (score >= RELEVANCE_THRESHOLDS.high ? "HIGH" : score >= RELEVANCE_THRESHOLDS.medium ? "MEDIUM" : score > 0 ? "LOW" : "NONE");
const strength: MappingImportance[] = ["MINOR", "SUPPORTING", "CORE"];

export function courseRelevance(courseSkills: CourseSkill[], requirements: Requirement[]): CourseRelevance {
  // a skill listed twice counts once, at its strongest
  const bySkill = new Map<string, MappingImportance>();
  for (const s of courseSkills) {
    const level = s.importance ?? "SUPPORTING";
    const prev = bySkill.get(s.skillId);
    if (!prev || strength.indexOf(level) > strength.indexOf(prev)) bySkill.set(s.skillId, level);
  }
  const weighted = (r: Requirement) => REQUIREMENT_WEIGHT[r.importance] * (r.targetLevel / 100);
  const demand = requirements.reduce((sum, r) => sum + weighted(r), 0);
  const matches: RelevanceMatch[] = [];
  for (const r of requirements) {
    const mapping = bySkill.get(r.skillId);
    if (mapping) matches.push({ skillId: r.skillId, requirement: r.importance, mapping, contribution: weighted(r) * MAPPING_STRENGTH[mapping] });
  }
  matches.sort((a, b) => b.contribution - a.contribution || a.skillId.localeCompare(b.skillId));
  const score = demand > 0 ? matches.reduce((sum, m) => sum + m.contribution, 0) / demand : 0;
  return { score, label: labelFor(score), demand, matches };
}

export interface CareerWithRequirements {
  id: string;
  name: string;
  requirements: Requirement[];
}

/** Careers ordered by how relevant this course is to each (ties by name, so the order is stable). */
export function rankCareersForCourse(courseSkills: CourseSkill[], careers: CareerWithRequirements[]) {
  return careers
    .map((c) => ({ careerId: c.id, careerName: c.name, relevance: courseRelevance(courseSkills, c.requirements) }))
    .sort((a, b) => b.relevance.score - a.relevance.score || a.careerName.localeCompare(b.careerName));
}

/** Courses ordered by how relevant each is to one career. */
export function rankCoursesForCareer(requirements: Requirement[], courses: { id: string; skills: CourseSkill[] }[]) {
  return courses.map((c) => ({ courseId: c.id, relevance: courseRelevance(c.skills, requirements) })).sort((a, b) => b.relevance.score - a.relevance.score || a.courseId.localeCompare(b.courseId));
}
