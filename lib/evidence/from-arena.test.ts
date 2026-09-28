import { describe, expect, it } from "vitest";
import { deriveArenaEvidence, type ArenaAttemptForEvidence } from "./from-arena";

function attempt(overrides: Partial<ArenaAttemptForEvidence> = {}): ArenaAttemptForEvidence {
  return {
    id: "attempt-1",
    section: "programming_fundamentals",
    status: "completed",
    answeredCount: 15,
    correctCount: 12,
    completedAt: "2026-09-28T00:00:00Z",
    ratingBefore: 1200,
    ratingDelta: 18,
    ratingAfter: 1218,
    ...overrides,
  };
}

describe("deriveArenaEvidence", () => {
  it("produces evidence for a completed attempt", () => {
    const row = deriveArenaEvidence(attempt());
    expect(row).not.toBeNull();
    expect(row?.evidenceType).toBe("arena_result");
    expect(row?.sourceIdentifier).toBe("arena:attempt-1");
  });

  it("produces no evidence for an in-progress attempt -- only a verified result counts", () => {
    expect(deriveArenaEvidence(attempt({ status: "in_progress", completedAt: null }))).toBeNull();
  });

  it("produces no evidence for an abandoned/failed attempt", () => {
    expect(deriveArenaEvidence(attempt({ status: "abandoned" }))).toBeNull();
  });

  it("carries the real ELO context in metadata rather than a fabricated score", () => {
    const row = deriveArenaEvidence(attempt({ ratingDelta: 24 }));
    expect(row?.metadata.ratingDelta).toBe(24);
    expect(row?.metadata.correctCount).toBe(12);
    expect(row?.metadata.answeredCount).toBe(15);
  });

  it("has no external source URL -- an Arena result is verified internally, not via a public link", () => {
    expect(deriveArenaEvidence(attempt())?.sourceUrl).toBeNull();
  });
});
