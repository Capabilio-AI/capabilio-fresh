import type { EvidenceRow } from "./types";

export const ARENA_CHALLENGES_ANALYSIS_VERSION = "arena-challenges.v1";

export interface ChallengeCompletionForEvidence {
  id: string;
  challengeTitle: string;
  track: "stream" | "domain";
  scopeKey: string;
  skillTags: string[];
  isCorrect: boolean;
  completedAt: string;
}

/**
 * Pure. Only a correct submission produces evidence -- an incorrect
 * attempt demonstrated an attempt, not a capability. One evidence row per
 * skill tag on the challenge (a challenge can exercise more than one
 * skill), each idempotent via its own source_identifier.
 */
export function deriveArenaChallengeEvidence(completion: ChallengeCompletionForEvidence): EvidenceRow[] {
  if (!completion.isCorrect) return [];

  return completion.skillTags.map((skill) => ({
    skill,
    evidenceType: "arena_result",
    sourceIdentifier: `arena-challenge:${completion.id}:${skill}`,
    sourceUrl: null,
    observedAt: completion.completedAt,
    confidence: "low",
    metadata: {
      challengeTitle: completion.challengeTitle,
      track: completion.track,
      scopeKey: completion.scopeKey,
    },
  }));
}
