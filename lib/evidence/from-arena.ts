import { SECTION_LABEL, type AssessmentSection } from "@/lib/assessment/sections";
import { confidenceFor } from "@/lib/capability/confidence";
import type { EvidenceRow } from "./types";

export const ARENA_ANALYSIS_VERSION = "arena.v1";

export interface ArenaAttemptForEvidence {
  id: string;
  section: AssessmentSection;
  status: string;
  answeredCount: number;
  correctCount: number;
  completedAt: string | null;
  ratingBefore: number | null;
  ratingDelta: number | null;
  ratingAfter: number | null;
}

/**
 * Pure. Only a completed attempt produces evidence — an in-progress or
 * abandoned attempt is not a verified result and must never look like one.
 * One evidence row per attempt id (idempotent via the source_identifier
 * unique index), so finishing the same attempt twice — which the RPC
 * itself should already prevent — still can't duplicate evidence even if
 * this were ever called twice for the same id.
 */
export function deriveArenaEvidence(attempt: ArenaAttemptForEvidence): EvidenceRow | null {
  if (attempt.status !== "completed" || !attempt.completedAt) return null;

  return {
    skill: SECTION_LABEL[attempt.section],
    evidenceType: "arena_result",
    sourceIdentifier: `arena:${attempt.id}`,
    sourceUrl: null,
    observedAt: attempt.completedAt,
    confidence: confidenceFor(attempt.answeredCount),
    metadata: {
      section: attempt.section,
      correctCount: attempt.correctCount,
      answeredCount: attempt.answeredCount,
      ratingBefore: attempt.ratingBefore,
      ratingDelta: attempt.ratingDelta,
      ratingAfter: attempt.ratingAfter,
    },
  };
}
