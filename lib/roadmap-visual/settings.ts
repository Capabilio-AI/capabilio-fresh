import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";

export const DEFAULT_INFERRED_MIN_CONFIDENCE = 0.8;

/** Pure. A mapping Capabilio inferred (not confirmed by a college) is shown only at or above the threshold, and only ever badged as inferred. */
export const showInferred = (confidence: number | null, threshold: number): boolean => confidence !== null && confidence >= threshold;

/** The tunable threshold (roadmap_settings.inferred_min_confidence); the safe default if it is missing or malformed. */
export async function getInferredMinConfidence(service: SupabaseClient<Database>): Promise<number> {
  const { data } = await untyped(service).from("roadmap_settings").select("value").eq("key", "inferred_min_confidence").maybeSingle();
  const v = Number(data?.value);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_INFERRED_MIN_CONFIDENCE;
}
