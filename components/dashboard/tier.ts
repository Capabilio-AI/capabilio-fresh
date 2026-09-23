export type ScoreTier = "high" | "mid" | "low";

export function scoreTier(percentage: number): ScoreTier {
  if (percentage >= 80) return "high";
  if (percentage >= 50) return "mid";
  return "low";
}

export const TIER_BAR: Record<ScoreTier, string> = {
  high: "bg-lp-success",
  mid: "bg-lp-accent-ochre",
  low: "bg-lp-error",
};

export const TIER_TEXT: Record<ScoreTier, string> = {
  high: "text-lp-success",
  mid: "text-lp-accent-ochre",
  low: "text-lp-error",
};
