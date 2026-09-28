import { describe, expect, it } from "vitest";
import { aggregateDemonstratedCapabilities, computeCapabilityStrength, sourceLabel, type EvidenceRecord } from "./aggregate-capabilities";

function row(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    skill: "Programming",
    sourceType: "github_repository",
    evidenceType: "technology_usage",
    sourceUrl: "https://github.com/student/repo",
    observedAt: "2026-06-01T00:00:00Z",
    confidence: "low",
    createdAt: "2026-06-02T00:00:00Z",
    ...overrides,
  };
}

describe("aggregateDemonstratedCapabilities", () => {
  it("groups multiple evidence rows for the same skill into one capability", () => {
    const result = aggregateDemonstratedCapabilities([row(), row({ sourceUrl: "https://github.com/student/other" })]);
    expect(result).toHaveLength(1);
    expect(result[0].evidenceCount).toBe(2);
  });

  it("reports the source mix across GitHub and Arena for a corroborated skill", () => {
    const result = aggregateDemonstratedCapabilities([
      row({ sourceType: "github_repository" }),
      row({ sourceType: "arena_challenge" }),
    ]);
    expect(result[0].sourceMix).toEqual(expect.arrayContaining(["github_repository", "arena_challenge"]));
  });

  it("picks the most recent observedAt across items", () => {
    const result = aggregateDemonstratedCapabilities([
      row({ observedAt: "2026-01-01T00:00:00Z" }),
      row({ observedAt: "2026-06-01T00:00:00Z" }),
    ]);
    expect(result[0].mostRecentAt).toBe("2026-06-01T00:00:00Z");
  });

  it("falls back to createdAt when observedAt is null", () => {
    const result = aggregateDemonstratedCapabilities([row({ observedAt: null, createdAt: "2026-03-01T00:00:00Z" })]);
    expect(result[0].mostRecentAt).toBe("2026-03-01T00:00:00Z");
  });

  it("sorts capabilities with the most evidence first", () => {
    const result = aggregateDemonstratedCapabilities([
      row({ skill: "Testing" }),
      row({ skill: "Programming" }),
      row({ skill: "Programming", sourceUrl: "https://github.com/student/other" }),
    ]);
    expect(result[0].skill).toBe("Programming");
    expect(result[0].evidenceCount).toBe(2);
  });
});

describe("computeCapabilityStrength", () => {
  const recent = new Date().toISOString();
  const old = "2020-01-01T00:00:00Z";

  it("gives commit_activity a higher directness floor than technology_usage alone", () => {
    const commit = computeCapabilityStrength([row({ evidenceType: "commit_activity", observedAt: recent })], ["github_repository"], recent);
    const tech = computeCapabilityStrength([row({ evidenceType: "technology_usage", observedAt: recent })], ["github_repository"], recent);
    expect(commit).toBeGreaterThan(tech);
  });

  it("rewards cross-source corroboration over a single source", () => {
    const single = computeCapabilityStrength([row({ observedAt: recent })], ["github_repository"], recent);
    const corroborated = computeCapabilityStrength(
      [row({ observedAt: recent }), row({ sourceType: "arena_challenge", evidenceType: "arena_result", observedAt: recent })],
      ["github_repository", "arena_challenge"],
      recent
    );
    expect(corroborated).toBeGreaterThan(single);
  });

  it("rewards recent evidence over stale evidence", () => {
    const fresh = computeCapabilityStrength([row({ observedAt: recent })], ["github_repository"], recent);
    const stale = computeCapabilityStrength([row({ observedAt: old })], ["github_repository"], old);
    expect(fresh).toBeGreaterThan(stale);
  });

  it("caps repetition instead of letting evidence count alone dominate the score", () => {
    const many = Array.from({ length: 20 }, () => row({ observedAt: recent }));
    const score = computeCapabilityStrength(many, ["github_repository"], recent);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("never exceeds 100", () => {
    const rows = [
      row({ evidenceType: "commit_activity", observedAt: recent }),
      row({ sourceType: "arena_challenge", evidenceType: "arena_result", observedAt: recent }),
      ...Array.from({ length: 10 }, () => row({ observedAt: recent })),
    ];
    expect(computeCapabilityStrength(rows, ["github_repository", "arena_challenge"], recent)).toBeLessThanOrEqual(100);
  });
});

describe("sourceLabel", () => {
  it("uses trust-safe language, never 'verified skill' or similar overclaims", () => {
    expect(sourceLabel("github_repository")).toBe("Observed on GitHub");
    expect(sourceLabel("arena_challenge")).toBe("Demonstrated in Arena");
  });

  it("falls back to the raw source type for an unrecognized value rather than throwing", () => {
    expect(sourceLabel("unknown_source")).toBe("unknown_source");
  });
});
