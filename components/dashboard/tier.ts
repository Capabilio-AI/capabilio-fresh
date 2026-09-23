export type ScoreTier = "high" | "mid" | "low";

export function scoreTier(percentage: number): ScoreTier {
  if (percentage >= 80) return "high";
  if (percentage >= 50) return "mid";
  return "low";
}

// "low" is a development signal, not a failure — never use alarm red for an
// ordinary low assessment score. Reserve app-error-strength red for actual
// error states (a failed request), not routine low performance.
export const TIER_BAR: Record<ScoreTier, string> = {
  high: "bg-app-success",
  mid: "bg-app-warning",
  low: "bg-app-attention",
};

export const TIER_TEXT: Record<ScoreTier, string> = {
  high: "text-app-success",
  mid: "text-app-warning",
  low: "text-app-attention",
};

export const TIER_CONTAINER: Record<ScoreTier, string> = {
  high: "bg-app-success-container text-app-success",
  mid: "bg-app-warning-container text-app-warning",
  low: "bg-app-attention-container text-app-attention",
};

export const TIER_LABEL: Record<ScoreTier, string> = {
  high: "Strong",
  mid: "Developing",
  low: "Needs development",
};
