import type { Difficulty } from "./types";

// Stream points, never ELO and never a Skill Passport update. Missions are worth more than a quick question because they take longer.
export const MISSION_POINTS: Record<Difficulty, number> = { easy: 45, medium: 60, hard: 75 };
export const MAX_HINTS = 3;
const HINT_COST = 0.15;
const MIN_HINT_FACTOR = 0.55;
/** trying at least this many different settings earns the experimenter bonus */
export const EXPERIMENTS_FOR_BONUS = 3;
const BONUS = 0.2;

export interface MissionScore {
  base: number;
  hintFactor: number;
  bonus: number;
  total: number;
}

/** Pure. Full points for finishing; each hint costs 15% (never below 55%); a student who experimented (3 or more different settings tried) earns 20% more. */
export function missionScore(difficulty: Difficulty, hintsUsed: number, distinctRuns: number): MissionScore {
  const base = MISSION_POINTS[difficulty] ?? MISSION_POINTS.easy;
  const hintFactor = Math.max(MIN_HINT_FACTOR, 1 - HINT_COST * Math.max(0, hintsUsed));
  const bonus = distinctRuns >= EXPERIMENTS_FOR_BONUS ? Math.round(base * BONUS) : 0;
  return { base, hintFactor, bonus, total: Math.round(base * hintFactor) + bonus };
}

/** minutes on the clock, by difficulty */
export const MISSION_MINUTES: Record<Difficulty, number> = { easy: 12, medium: 18, hard: 25 };
