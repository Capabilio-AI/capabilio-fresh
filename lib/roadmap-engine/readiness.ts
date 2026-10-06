/**
 * Readiness — PURE.
 *
 *   readiness = 100 × Σ weight(importance) × min(level / target, 1)  ÷  Σ weight(importance)
 *
 * over the career's required skills, where weight is CRITICAL 4 / HIGH 3 / MEDIUM 2 / LOW 1 and `level` is the student's EFFECTIVE level:
 * the verified level, or — if they have only claimed the skill — half of the claim (a claim is capped at 40 first). Over-achieving a
 * target never counts above 1, and a skill with no evidence counts as 0, not as a guess.
 */
import { REQUIREMENT_WEIGHT } from "@/lib/careers/relevance";
import { effectiveLevel } from "./gaps";
import type { CareerRequirement, StudentSkillInput } from "./types";

export const READINESS_EXPLANATION =
  "Readiness is how close you are to your target career's skill levels, from 0 to 100. Each required skill counts by its importance (critical skills count four times as much as low-importance ones) and by how far you are toward its target level — reaching the target counts as full, and going beyond it adds nothing extra. Your level comes from verified evidence (assessments, Arena tasks, projects). A skill you have only claimed yourself counts for half of a capped claim, and a skill with no evidence counts as zero.";

export function computeReadiness(requirements: CareerRequirement[], capability: Record<string, StudentSkillInput>): number {
  const total = requirements.reduce((n, r) => n + REQUIREMENT_WEIGHT[r.importance], 0);
  if (total === 0) return 0;
  const earned = requirements.reduce((n, r) => n + REQUIREMENT_WEIGHT[r.importance] * Math.min(effectiveLevel(capability[r.skillId]) / Math.max(r.targetLevel, 1), 1), 0);
  return Math.round((earned / total) * 100);
}
