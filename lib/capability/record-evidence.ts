import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/lib/supabase/types";
import { generateGuidePathForCareer } from "@/lib/guide-path/generate";
import { confidenceFor } from "./confidence";

type EvidenceSource = Enums<"capability_evidence_source">;
type Confidence = Enums<"capability_confidence">;

// A project milestone or Arena challenge is worth interrupting the student
// for; a routine learning-module check-in or an already-triggered
// reassessment is not — matches the brief's own two examples verbatim.
const MAJOR_EVIDENCE_SOURCES: EvidenceSource[] = ["project", "arena_challenge"];

export interface EvidenceInput {
  userId: string;
  skill: string;
  domain: string;
  newScore: number;
  source: EvidenceSource;
}

/**
 * Capability scores must update from real evidence over time, not just the
 * initial assessment — this is the callable entry point every evidence
 * producer (learning module, project eval, Arena, manual reassessment)
 * goes through. Appends to capability_history (so the dashboard can show
 * "improved from 31 to 74"), updates the current capabilities row, and
 * closes the loop from Phase 3: Evidence -> Capability Update -> Guide Path
 * recalculation -> new Next Best Action. Any existing guide path (primary
 * and Plan B) is regenerated so it reflects the new capability immediately.
 */
export async function recordCapabilityEvidence(
  supabase: SupabaseClient<Database>,
  serviceClient: SupabaseClient<Database>,
  input: EvidenceInput
): Promise<{ capabilityScore: number; confidence: Confidence; shouldPromptReassessment: boolean }> {
  const { data: existing } = await serviceClient
    .from("capabilities")
    .select("data_points")
    .eq("user_id", input.userId)
    .eq("skill", input.skill)
    .maybeSingle();

  const dataPoints = (existing?.data_points ?? 0) + 1;
  const confidence = confidenceFor(dataPoints);

  const { error: upsertError } = await serviceClient.from("capabilities").upsert(
    {
      user_id: input.userId,
      skill: input.skill,
      domain: input.domain,
      capability_score: input.newScore,
      confidence,
      data_points: dataPoints,
    },
    { onConflict: "user_id,skill" }
  );
  if (upsertError) throw upsertError;

  const { error: historyError } = await serviceClient.from("capability_history").insert({
    user_id: input.userId,
    skill: input.skill,
    capability_score: input.newScore,
    confidence,
    source: input.source,
  });
  if (historyError) throw historyError;

  const { data: guidePaths } = await serviceClient
    .from("guide_paths")
    .select("target_career, is_primary")
    .eq("user_id", input.userId);
  for (const path of guidePaths ?? []) {
    await generateGuidePathForCareer(
      supabase,
      serviceClient,
      input.userId,
      path.target_career,
      path.is_primary
    );
  }

  return {
    capabilityScore: input.newScore,
    confidence,
    shouldPromptReassessment: MAJOR_EVIDENCE_SOURCES.includes(input.source),
  };
}
