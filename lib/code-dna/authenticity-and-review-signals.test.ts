import { describe, expect, it } from "vitest";
import { deriveAuthenticityAndReview } from "./authenticity-and-review-signals";
import type { FullRepoAnalysis } from "./github-scan";

function repo(overrides: Partial<FullRepoAnalysis>): FullRepoAnalysis {
  return {
    name: "repo",
    fullName: "user/repo",
    htmlUrl: "https://github.com/user/repo",
    description: null,
    isFork: false,
    forkSourceFullName: null,
    forkSourceUrl: null,
    primaryLanguage: null,
    topics: [],
    license: null,
    stars: 0,
    forksCount: 0,
    isArchived: false,
    sizeKb: 100,
    repoCreatedAt: null,
    repoUpdatedAt: null,
    candidateCommitCount: 0,
    candidatePrCount: 0,
    candidatePrMergedCount: 0,
    firstCandidateCommitAt: null,
    lastCandidateCommitAt: null,
    authorshipSample: null,
    techSignals: [],
    hasTests: false,
    hasCi: false,
    hasReadme: false,
    hasDependencies: false,
    hasDatabaseSignal: false,
    hasAuthSignal: false,
    contributorsCount: null,
    scanStatus: "ok",
    scanError: null,
    ...overrides,
  };
}

const ALL_SIGNAL_TEXT = (r: ReturnType<typeof deriveAuthenticityAndReview>) =>
  [...r.authenticitySignals, ...r.reviewSignals].map((s) => `${s.signal} ${s.detail}`).join(" ").toLowerCase();

describe("deriveAuthenticityAndReview", () => {
  it("never uses accusation or certainty language anywhere in its output", () => {
    const result = deriveAuthenticityAndReview([
      repo({ isFork: true, candidateCommitCount: 20, authorshipSample: 0.2, firstCandidateCommitAt: "2026-01-01T00:00:00Z", lastCandidateCommitAt: "2026-01-02T00:00:00Z" }),
    ]);
    const text = ALL_SIGNAL_TEXT(result);
    for (const banned of ["genuine", "did not copy", "definitely the author", "copied this repository", "plagiar"]) {
      expect(text).not.toContain(banned);
    }
  });

  it("does not penalize a fork by itself — a fork-heavy portfolio is a neutral review signal, not an accusation", () => {
    const result = deriveAuthenticityAndReview([repo({ isFork: true }), repo({ name: "b", isFork: true })]);
    const forkSignal = result.reviewSignals.find((s) => s.signal === "Fork-heavy portfolio");
    expect(forkSignal).toBeDefined();
    expect(forkSignal?.detail.toLowerCase()).not.toContain("suspicious");
    expect(forkSignal?.detail.toLowerCase()).not.toContain("bad");
  });

  it("raises a consistent-authorship signal only when the real sampled share meets the threshold", () => {
    const strong = deriveAuthenticityAndReview([repo({ authorshipSample: 0.9, candidateCommitCount: 5 })]);
    expect(strong.authenticitySignals.some((s) => s.signal === "Consistent authorship signals")).toBe(true);

    const weak = deriveAuthenticityAndReview([repo({ authorshipSample: 0.2, candidateCommitCount: 5 })]);
    expect(weak.authenticitySignals.some((s) => s.signal === "Consistent authorship signals")).toBe(false);
  });

  it("flags a short contribution window as a review signal, without inferring intent", () => {
    const result = deriveAuthenticityAndReview([
      repo({ candidateCommitCount: 15, firstCandidateCommitAt: "2026-01-01T00:00:00Z", lastCandidateCommitAt: "2026-01-03T00:00:00Z" }),
    ]);
    const signal = result.reviewSignals.find((s) => s.signal === "Contribution concentrated in a short period");
    expect(signal).toBeDefined();
    expect(signal?.detail.toLowerCase()).not.toMatch(/intent|suspicious|fake/);
  });

  it("computes GitHub Evidence Confidence deterministically from real signals, never from an LLM call", () => {
    const strong = deriveAuthenticityAndReview([
      repo({ name: "a", candidateCommitCount: 10, authorshipSample: 1, hasTests: true, hasCi: true, hasReadme: true, hasDependencies: true, candidatePrCount: 3, candidatePrMergedCount: 3 }),
      repo({ name: "b", candidateCommitCount: 10, authorshipSample: 1 }),
      repo({ name: "c", candidateCommitCount: 10, authorshipSample: 1 }),
    ]);
    expect(strong.evidenceConfidence).toBeGreaterThan(80);

    const weak = deriveAuthenticityAndReview([repo({ isFork: true })]);
    expect(weak.evidenceConfidence).toBeLessThan(20);
  });
});
