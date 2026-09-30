// Fixed, deterministic point values by difficulty — never AI-assigned.
// Generation writes a challenge's difficulty; points are computed from
// that difficulty here, at submit time, not trusted from the model's own
// output.
export const POINTS_BY_DIFFICULTY: Record<"easy" | "medium" | "hard", number> = {
  easy: 15,
  medium: 20,
  hard: 25,
};

export function pointsForDifficulty(difficulty: string): number {
  return POINTS_BY_DIFFICULTY[difficulty as "easy" | "medium" | "hard"] ?? POINTS_BY_DIFFICULTY.easy;
}
