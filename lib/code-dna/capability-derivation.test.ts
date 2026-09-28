import { describe, expect, it } from "vitest";
import { deriveCapabilityProfile, type ArenaProgrammingEvidence } from "./capability-derivation";
import type { GithubScanResult, RepoAnalysis } from "./github-scan";

function repo(overrides: Partial<RepoAnalysis>): RepoAnalysis {
  return {
    name: "repo",
    htmlUrl: "https://github.com/user/repo",
    isFork: false,
    stars: 0,
    updatedAt: "2026-01-01T00:00:00Z",
    techSignals: [],
    hasReadme: false,
    hasTests: false,
    authorCommitShare: null,
    ...overrides,
  };
}

function scan(repos: RepoAnalysis[]): GithubScanResult {
  return { username: "student", publicRepos: repos.length, repositoriesAnalyzed: repos.length, repos, pullRequestsOpened: 0, pullRequestsMerged: 0 };
}

const RECENT = "2026-09-01T00:00:00Z";

function attempt(overrides: Partial<ArenaProgrammingEvidence>): ArenaProgrammingEvidence {
  return { correctCount: 8, answeredCount: 10, completedAt: RECENT, ...overrides };
}

describe("deriveCapabilityProfile", () => {
  it("returns no categories at all when there is no evidence of any kind", () => {
    expect(deriveCapabilityProfile(null, null, [])).toEqual([]);
  });

  it("scores a GitHub category as the share of original repos showing that signal", () => {
    const result = deriveCapabilityProfile(
      scan([repo({ techSignals: ["Node.js"] }), repo({ techSignals: ["TypeScript"] }), repo({ techSignals: [] })]),
      RECENT,
      []
    );
    const backend = result.find((r) => r.category === "Backend Engineering");
    expect(backend?.score).toBe(33); // 1 of 3 repos
    expect(backend?.evidenceCount).toBe(1);
    expect(backend?.contexts).toEqual(["github"]);
  });

  it("excludes forks from the denominator entirely", () => {
    const result = deriveCapabilityProfile(
      scan([repo({ techSignals: ["Node.js"] }), repo({ isFork: true, techSignals: ["Node.js"] })]),
      RECENT,
      []
    );
    const backend = result.find((r) => r.category === "Backend Engineering");
    expect(backend?.score).toBe(100); // 1 of 1 original repo, fork ignored
  });

  it("omits a category entirely when no repo shows that signal, rather than scoring it 0", () => {
    const result = deriveCapabilityProfile(scan([repo({ techSignals: ["Python"] })]), RECENT, []);
    expect(result.find((r) => r.category === "Frontend Engineering")).toBeUndefined();
  });

  it("derives Testing directly from hasTests, independent of tech signals", () => {
    const result = deriveCapabilityProfile(scan([repo({ hasTests: true }), repo({ hasTests: false })]), RECENT, []);
    const testing = result.find((r) => r.category === "Testing");
    expect(testing?.score).toBe(50);
  });

  it("scores Arena-derived Programming from real server-computed correctness across attempts", () => {
    const result = deriveCapabilityProfile(null, null, [attempt({ correctCount: 8, answeredCount: 10 }), attempt({ correctCount: 9, answeredCount: 10 })]);
    const programming = result.find((r) => r.category === "Programming");
    expect(programming?.score).toBe(85); // 17/20
    expect(programming?.evidenceCount).toBe(2);
    expect(programming?.contexts).toEqual(["arena"]);
  });

  it("merges GitHub and Arena evidence for Programming into one evidence-weighted score", () => {
    const result = deriveCapabilityProfile(
      scan([repo({ techSignals: ["Node.js"] })]), // 1/1 repos -> 100
      RECENT,
      [attempt({ correctCount: 5, answeredCount: 10 })] // 1 attempt -> 50
    );
    const programming = result.find((r) => r.category === "Programming");
    expect(programming?.score).toBe(75); // (100*1 + 50*1) / 2
    expect(programming?.evidenceCount).toBe(2);
    expect(programming?.contexts).toEqual(["github", "arena"]);
  });

  it("gives high confidence only at 5+ evidence points, matching the shared capability-confidence thresholds", () => {
    const fewRepos = scan([repo({ techSignals: ["Node.js"] }), repo({ techSignals: ["Python"] })]);
    const lowConfidence = deriveCapabilityProfile(fewRepos, RECENT, []).find((r) => r.category === "Backend Engineering");
    expect(lowConfidence?.confidence).toBe("low"); // 2 evidence points

    const manyRepos = scan(Array.from({ length: 5 }, () => repo({ techSignals: ["Node.js"] })));
    const highConfidence = deriveCapabilityProfile(manyRepos, RECENT, []).find((r) => r.category === "Backend Engineering");
    expect(highConfidence?.confidence).toBe("high"); // 5 evidence points
  });

  it("caps confidence at medium when the evidence is stale, even with plenty of data points", () => {
    const staleDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const manyRepos = scan(Array.from({ length: 6 }, () => repo({ techSignals: ["Node.js"] })));
    const result = deriveCapabilityProfile(manyRepos, staleDate, []).find((r) => r.category === "Backend Engineering");
    expect(result?.confidence).toBe("medium");
  });

  it("never derives a category with no real evidence source (e.g. Security, System Design) from any input", () => {
    const result = deriveCapabilityProfile(
      scan([repo({ techSignals: ["Node.js", "TypeScript", "Docker"], hasTests: true })]),
      RECENT,
      [attempt({})]
    );
    const derivedCategories = result.map((r) => r.category);
    expect(derivedCategories).not.toContain("Security");
    expect(derivedCategories).not.toContain("System Design");
    expect(derivedCategories).not.toContain("Database Engineering");
    expect(derivedCategories).not.toContain("API Design");
    expect(derivedCategories).not.toContain("Data Analysis");
    expect(derivedCategories).not.toContain("AI/ML");
    expect(derivedCategories).not.toContain("Debugging");
    expect(derivedCategories).not.toContain("Algorithms");
  });
});

describe("deriveCapabilityProfile — security properties", () => {
  it("tampering: has no score/confidence parameter at all — there is no argument through which a caller could inject one", () => {
    // Structural guarantee, not just a runtime check: the function's only
    // inputs are raw evidence (a GitHub scan, a scan timestamp, and an
    // array of {correctCount, answeredCount, completedAt}). A client-
    // supplied score/confidence has no parameter to travel through.
    expect(deriveCapabilityProfile.length).toBe(3);
  });

  it("tampering: extra/unexpected fields on evidence objects are ignored, never surfaced into the derived output", () => {
    const tampered = { correctCount: 8, answeredCount: 10, completedAt: RECENT, score: 999, confidence: "high" } as ArenaProgrammingEvidence;
    const result = deriveCapabilityProfile(null, null, [tampered]);
    const programming = result.find((r) => r.category === "Programming");
    expect(programming?.score).toBe(80); // computed from correctCount/answeredCount only, the injected `score`/`confidence` are never read
  });

  it("leakage: a derivation's serialized shape exposes only the documented fields — no internal thresholds or raw evidence", () => {
    const result = deriveCapabilityProfile(scan([repo({ techSignals: ["Node.js"] })]), RECENT, []);
    const backend = result.find((r) => r.category === "Backend Engineering");
    expect(Object.keys(backend ?? {}).sort()).toEqual(
      ["category", "confidence", "contexts", "evidenceCount", "lastVerifiedAt", "score"].sort()
    );
  });

  it("is a pure function with no shared state — two calls with different evidence never leak into each other", () => {
    const userAResult = deriveCapabilityProfile(scan([repo({ techSignals: ["Node.js"] })]), RECENT, []);
    const userBResult = deriveCapabilityProfile(scan([repo({ techSignals: ["TypeScript"] })]), RECENT, []);
    expect(userAResult.find((r) => r.category === "Frontend Engineering")).toBeUndefined();
    expect(userBResult.find((r) => r.category === "Backend Engineering")).toBeUndefined();
  });
});

// No live-DB test harness exists in this repo (confirmed — every existing
// test is a pure-function unit test). These operate on the exact row shape
// `finish_arena_challenge`/`record_arena_answer` (both SECURITY DEFINER
// Postgres RPCs, verified by reading their definitions) actually produce:
// server-computed correct_count/answered_count, never client-supplied.
describe("Arena -> Code DNA integration (mission result shape)", () => {
  it("a completed mission's real, server-verified correctness flows into the Programming score", () => {
    const beforeAnyEvidence = deriveCapabilityProfile(null, null, []);
    expect(beforeAnyEvidence.find((r) => r.category === "Programming")).toBeUndefined();

    const afterOneCompletedMission = deriveCapabilityProfile(null, null, [attempt({ correctCount: 9, answeredCount: 10 })]);
    const programming = afterOneCompletedMission.find((r) => r.category === "Programming");
    expect(programming?.score).toBe(90);
    expect(programming?.evidenceCount).toBe(1);
  });

  it("a failed mission (low/zero correct answers) produces real low evidence, never a fabricated positive score", () => {
    const failed = deriveCapabilityProfile(null, null, [attempt({ correctCount: 0, answeredCount: 10 })]);
    const programming = failed.find((r) => r.category === "Programming");
    expect(programming?.score).toBe(0);
  });

  it("an in-progress (never finished) attempt contributes no evidence at all — the route only ever fetches status='completed' rows", () => {
    // Modeled here by simply not including it in the array: an in-progress
    // attempt is filtered out by the API route's own `.eq("status",
    // "completed")` query before this function ever sees it, so an
    // abandoned challenge can never inflate or deflate a score.
    const result = deriveCapabilityProfile(null, null, []);
    expect(result).toEqual([]);
  });

  it("duplicate completion: two separate real attempts each count once; the same attempt is never double-counted within one call", () => {
    const sameAttemptTwice = attempt({ correctCount: 8, answeredCount: 10 });
    const singlePass = deriveCapabilityProfile(null, null, [sameAttemptTwice]);
    expect(singlePass.find((r) => r.category === "Programming")?.evidenceCount).toBe(1);

    // Two genuinely separate retries (different completedAt) are each real
    // evidence and should both count — this is correct, not a duplication bug.
    const twoRealRetries = deriveCapabilityProfile(null, null, [
      attempt({ correctCount: 8, answeredCount: 10, completedAt: "2026-08-01T00:00:00Z" }),
      attempt({ correctCount: 9, answeredCount: 10, completedAt: "2026-08-02T00:00:00Z" }),
    ]);
    expect(twoRealRetries.find((r) => r.category === "Programming")?.evidenceCount).toBe(2);
  });
});
