import { POINTS_BY_DIFFICULTY } from "../points";
import type { Difficulty } from "./types";

// Every Stream challenge, a simulator or a calculation, in any branch, pays the same fixed points: 15 easy, 20 medium, 25 hard. Hints and the
// number of tries change nothing, so two students who solve the same challenge always earn the same.
export const MISSION_POINTS: Record<Difficulty, number> = POINTS_BY_DIFFICULTY;
export const MAX_HINTS = 3;

export interface MissionScore {
  base: number;
  total: number;
}

/** Pure. The fixed points for the challenge's difficulty. */
export function missionScore(difficulty: Difficulty): MissionScore {
  const base = MISSION_POINTS[difficulty] ?? MISSION_POINTS.easy;
  return { base, total: base };
}

/** minutes on the clock, by difficulty */
export const MISSION_MINUTES: Record<Difficulty, number> = { easy: 12, medium: 18, hard: 25 };
