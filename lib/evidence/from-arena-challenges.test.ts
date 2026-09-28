import { describe, expect, it } from "vitest";
import { deriveArenaChallengeEvidence, type ChallengeCompletionForEvidence } from "./from-arena-challenges";

function completion(overrides: Partial<ChallengeCompletionForEvidence> = {}): ChallengeCompletionForEvidence {
  return {
    id: "completion-1",
    challengeTitle: "Compute average sensor reading",
    track: "stream",
    scopeKey: "Mechanical Engineering",
    skillTags: ["Python", "Data Processing"],
    isCorrect: true,
    completedAt: "2026-09-28T00:00:00Z",
    ...overrides,
  };
}

describe("deriveArenaChallengeEvidence", () => {
  it("produces no evidence for an incorrect submission -- an attempt is not a capability", () => {
    expect(deriveArenaChallengeEvidence(completion({ isCorrect: false }))).toEqual([]);
  });

  it("produces one evidence row per skill tag for a correct submission", () => {
    const rows = deriveArenaChallengeEvidence(completion());
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.skill)).toEqual(["Python", "Data Processing"]);
  });

  it("has no external source URL -- verified internally, like an Arena quiz result", () => {
    expect(deriveArenaChallengeEvidence(completion())[0].sourceUrl).toBeNull();
  });

  it("uses a stable, per-skill source_identifier so a resubmission never duplicates evidence", () => {
    const rows = deriveArenaChallengeEvidence(completion());
    expect(rows[0].sourceIdentifier).toBe("arena-challenge:completion-1:Python");
  });
});
