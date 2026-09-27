import type { CareerMatch } from "./skill-gap";

export type RecommendationReasonKind = "skills" | "closest-gap" | "interest" | "none";

export interface RecommendationExplanation {
  matchesStatedInterest: boolean;
  reasonKind: RecommendationReasonKind;
  /** Real skill names where the student is already at or above the required level (gap === 0). */
  strongestSkills: string[];
  /** Real data even when weak: the smallest remaining gap, only meaningful when overall readiness is non-zero. */
  closestGapSkill: string | null;
  /** Real interestLevel (0-100) from interests.distribution — the actual tie-breaker when readiness is 0 across every career. */
  interestLevel: number;
}

/**
 * Every field here traces back to buildCareerMatch's own numbers — nothing
 * here is invented copy. Deliberately does NOT default to a skill-based
 * "why" when skill-level evidence is actually absent: capability names come
 * from fine-grained, auto-generated question skills (e.g. "Time-Speed-
 * Distance"), while career_requirements uses coarse category names (e.g.
 * "SQL"). For most real accounts today those two vocabularies don't
 * exact-match at all, so overallReadiness computes to 0% and the ranking
 * is actually decided by interestLevel (interests.distribution) — this
 * function reports that honestly (reasonKind: "interest") instead of
 * fabricating a skill-based reason that isn't really driving the result.
 */
export function explainRecommendation(match: CareerMatch, statedInterest: string): RecommendationExplanation {
  const matchesStatedInterest = match.careerRole.trim().toLowerCase() === statedInterest.trim().toLowerCase();

  const strongestSkills = match.skillGaps
    .filter((g) => g.gap === 0 && g.current !== null)
    .map((g) => g.skill)
    .slice(0, 3);

  const closestGap =
    strongestSkills.length === 0 && match.overallReadiness > 0
      ? [...match.skillGaps].filter((g) => g.gap > 0).sort((a, b) => a.gap - b.gap)[0]
      : undefined;

  let reasonKind: RecommendationReasonKind;
  if (strongestSkills.length > 0) reasonKind = "skills";
  else if (closestGap) reasonKind = "closest-gap";
  else if (match.interestLevel > 0) reasonKind = "interest";
  else reasonKind = "none";

  return {
    matchesStatedInterest,
    reasonKind,
    strongestSkills,
    closestGapSkill: closestGap?.skill ?? null,
    interestLevel: match.interestLevel,
  };
}
