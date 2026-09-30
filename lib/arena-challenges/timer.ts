// Shared by both tracks — Stream and Domain run the same clock per difficulty.
export const TIME_LIMIT_MINUTES: Record<"easy" | "medium" | "hard", number> = {
  easy: 8,
  medium: 12,
  hard: 15,
};

export function timeLimitForDifficulty(difficulty: string): number {
  return TIME_LIMIT_MINUTES[difficulty as "easy" | "medium" | "hard"] ?? TIME_LIMIT_MINUTES.easy;
}
