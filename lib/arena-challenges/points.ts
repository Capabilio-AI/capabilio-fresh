// Fixed, deterministic point values by difficulty — never AI-assigned.
// Generation writes a challenge's difficulty; points are computed from
// that difficulty here, at submit time, not trusted from the model's own
// output.
export const POINTS_BY_DIFFICULTY: Record<"easy" | "medium" | "hard", number> = {
  easy: 50,
  medium: 70,
  hard: 100,
};

export function pointsForDifficulty(difficulty: string): number {
  return POINTS_BY_DIFFICULTY[difficulty as "easy" | "medium" | "hard"] ?? POINTS_BY_DIFFICULTY.easy;
}

// The wheel's possible weekly task counts — this is a gamification/pacing
// choice (how many practice tasks you get this week), not a trust-
// sensitive score, so a genuine random pick (still server-side, never
// client-decided) is the honest implementation of "spin the wheel".
export const TASK_COUNT_OPTIONS = [5, 6, 7, 8, 9, 10] as const;

export function pickTaskCount(): number {
  return TASK_COUNT_OPTIONS[Math.floor(Math.random() * TASK_COUNT_OPTIONS.length)];
}
