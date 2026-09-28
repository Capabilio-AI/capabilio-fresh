import type { Enums } from "@/lib/supabase/types";

type Confidence = Enums<"capability_confidence">;

// Never present a capability score as certain when it's based on 1-2 data
// points — thresholds for how many independent evidence points are needed
// before trusting the score. Shared by every capability-scoring path
// (initial assessment, evidence recording, Code DNA derivation) so
// "medium confidence" means the same thing everywhere.
export const HIGH_CONFIDENCE_MIN = 5;
export const MEDIUM_CONFIDENCE_MIN = 3;

export function confidenceFor(dataPoints: number): Confidence {
  if (dataPoints >= HIGH_CONFIDENCE_MIN) return "high";
  if (dataPoints >= MEDIUM_CONFIDENCE_MIN) return "medium";
  return "low";
}
