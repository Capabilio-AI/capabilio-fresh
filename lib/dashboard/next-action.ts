import type { CareerMatch } from "@/lib/career/skill-gap";

export interface NextAction {
  skill: string;
  why: string;
  relatedCareer: string;
  currentLevel: number | null;
  targetLevel: number;
  estimatedWeeks: number;
}

/**
 * Picks the single largest skill gap on the student's top career match — the
 * one lever most worth pulling right now, not a menu of five equal options.
 */
export function computeNextAction(match: CareerMatch | null): NextAction | null {
  if (!match) return null;
  const gaps = [...match.skillGaps].filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap);
  const top = gaps[0];
  if (!top) return null;

  // ponytail: gap points -> weeks is a straight-line heuristic (5 pts/week),
  // not a modeled estimate. Replace with guide_paths' own phase pacing once
  // every top career match has a generated guide path.
  const estimatedWeeks = Math.max(2, Math.round(top.gap / 5));

  return {
    skill: top.skill,
    why: `The biggest lever for ${match.careerRole} readiness right now — closing it moves your overall readiness more than any other single skill.`,
    relatedCareer: match.careerRole,
    currentLevel: top.current,
    targetLevel: top.required,
    estimatedWeeks,
  };
}
