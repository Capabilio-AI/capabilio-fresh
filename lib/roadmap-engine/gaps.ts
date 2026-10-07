/** Gap analysis — PURE. Per required skill: where the student is, how far from the target, and whether/how the curriculum covers it. */
import { MAPPING_STRENGTH, REQUIREMENT_WEIGHT } from "@/lib/careers/relevance";
import { SELF_DECLARED_MAX_LEVEL } from "@/lib/capability/read-model";
import type { Coverage, CourseInput, EngineInput, GapRow, GapType, StudentSkillInput } from "./types";

/** Self-declared evidence counts for half of its (already capped) level; verified evidence counts in full. */
export const SELF_DECLARED_WEIGHT = 0.5;

export function effectiveLevel(s: StudentSkillInput | undefined): number {
  if (!s) return 0;
  if (s.verifiedLevel !== null) return s.verifiedLevel;
  return Math.round(Math.min(s.selfDeclaredLevel ?? 0, SELF_DECLARED_MAX_LEVEL) * SELF_DECLARED_WEIGHT);
}

export function classifyCoverage(skillId: string, courses: CourseInput[]): { coverage: Coverage; courseIds: string[]; outcomeCount: number } {
  const hits = courses.flatMap((c) => c.skills.filter((s) => s.skillId === skillId).map((s) => ({ courseId: c.id, importance: s.importance ?? "SUPPORTING", outcomes: s.outcomeCount })));
  if (hits.length === 0) return { coverage: "NONE", courseIds: [], outcomeCount: 0 };
  const outcomeCount = hits.reduce((n, h) => n + h.outcomes, 0);
  const core = hits.some((h) => h.importance === "CORE");
  const solid = hits.filter((h) => h.importance !== "MINOR").length;
  // STRONG: taught as a core skill, or by several courses (at least one more than a light touch), or backed by several confirmed outcomes
  const strong = core || (hits.length >= 2 && solid >= 1) || outcomeCount >= 3;
  return { coverage: strong ? "STRONG" : "PARTIAL", courseIds: [...new Set(hits.map((h) => h.courseId))], outcomeCount };
}

export function gapTypeFor(coverage: Coverage, hasLearning: boolean, hasPractice: boolean): GapType {
  if (coverage === "STRONG") return "COVERED_BY_CURRICULUM";
  if (coverage === "PARTIAL") return "PARTIALLY_COVERED";
  if (hasLearning) return "NEEDS_EXTERNAL_LEARNING";
  if (hasPractice) return "NEEDS_PRACTICAL_EXPERIENCE";
  return "NOT_COVERED";
}

export function analyseGaps(input: Pick<EngineInput, "requirements" | "courses" | "capability" | "catalogs">): GapRow[] {
  const { learning, projects, arena } = input.catalogs;
  const rows = input.requirements.map((r): GapRow => {
    const s = input.capability[r.skillId];
    const currentLevel = effectiveLevel(s);
    const gap = Math.max(0, r.targetLevel - currentLevel);
    const cov = classifyCoverage(r.skillId, input.courses);
    const hasLearning = learning.some((l) => l.skillIds.includes(r.skillId));
    const hasPractice = arena.some((a) => a.active && a.skillIds.includes(r.skillId)) || projects.some((p) => p.status === "ACTIVE" && p.skillIds.includes(r.skillId));
    return {
      skillId: r.skillId, skillName: r.skillName, importance: r.importance, targetLevel: r.targetLevel, stage: r.stage, parentSkillId: r.parentSkillId,
      currentLevel, assessed: Boolean(s?.assessed), confidence: s?.confidence ?? 0, verified: Boolean(s?.verified), selfDeclaredOnly: Boolean(s && !s.verified && s.selfDeclaredLevel !== null),
      gap, met: gap === 0, coverage: cov.coverage, coverageCourseIds: cov.courseIds, coverageOutcomeCount: cov.outcomeCount,
      gapType: gap === 0 ? null : gapTypeFor(cov.coverage, hasLearning, hasPractice),
    };
  });
  return rows.sort((a, b) => REQUIREMENT_WEIGHT[b.importance] - REQUIREMENT_WEIGHT[a.importance] || b.gap - a.gap || a.skillName.localeCompare(b.skillName));
}

export { MAPPING_STRENGTH };
