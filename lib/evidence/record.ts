import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { EvidenceRow } from "./types";

export type EvidenceSourceType = Database["public"]["Enums"]["capability_evidence_source"];

/**
 * Writes evidence rows via the service-role client only — `evidence` has no
 * client-writable RLS policy (self-read only), matching every other
 * server-computed table in this codebase. Upserts on
 * (user_id, source_type, source_identifier), so a rescan replaces rather
 * than duplicates evidence for the same repo/category or Arena attempt.
 */
export async function recordEvidence(
  service: SupabaseClient<Database>,
  userId: string,
  sourceType: EvidenceSourceType,
  analysisVersion: string,
  rows: EvidenceRow[]
): Promise<void> {
  if (rows.length === 0) return;

  const { error } = await service.from("evidence").upsert(
    rows.map((r) => ({
      user_id: userId,
      skill: r.skill,
      source_type: sourceType,
      evidence_type: r.evidenceType,
      source_identifier: r.sourceIdentifier,
      source_url: r.sourceUrl,
      observed_at: r.observedAt,
      confidence: r.confidence,
      // Record<string, unknown> (the ergonomic authoring type in EvidenceRow)
      // has no implicit index signature, so it isn't structurally
      // assignable to Supabase's Json type even though every value here is
      // always plain JSON -- same gotcha as ContributorSummary earlier this
      // session (github-scan.ts).
      metadata: r.metadata as Database["public"]["Tables"]["evidence"]["Insert"]["metadata"],
      analysis_version: analysisVersion,
    })),
    { onConflict: "user_id,source_type,source_identifier" }
  );
  if (error) throw error;
}
