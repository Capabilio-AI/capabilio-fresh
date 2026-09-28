import { describe, expect, it } from "vitest";
import { deriveTechnologyObservations } from "./technology-derivation";
import type { FullRepoAnalysis } from "./github-scan";

function repo(overrides: Partial<FullRepoAnalysis>): FullRepoAnalysis {
  return {
    name: "repo",
    fullName: "user/repo",
    owner: "user",
    htmlUrl: "https://github.com/user/repo",
    description: null,
    isFork: false,
    forkSourceFullName: null,
    forkSourceUrl: null,
    primaryLanguage: null,
    languages: [],
    topics: [],
    license: null,
    stars: 0,
    forksCount: 0,
    isArchived: false,
    sizeKb: 100,
    repoCreatedAt: "2025-01-01T00:00:00Z",
    repoUpdatedAt: "2026-01-01T00:00:00Z",
    candidateCommitCount: 5,
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
    topContributors: [],
    scanStatus: "ok",
    scanError: null,
    ...overrides,
  };
}

const RECENT = new Date().toISOString();
const OLD = "2019-01-01T00:00:00Z";

describe("deriveTechnologyObservations", () => {
  it("never scores a single, old, one-off signal as 'strong' — package presence alone is not strength", () => {
    const result = deriveTechnologyObservations([repo({ techSignals: ["Python"], repoUpdatedAt: OLD })]);
    expect(result.find((t) => t.technology === "Python")?.strength).toBe("limited");
  });

  it("scores 'strong' only when repeated across repos AND recent", () => {
    const result = deriveTechnologyObservations([
      repo({ name: "a", techSignals: ["TypeScript"], repoUpdatedAt: RECENT }),
      repo({ name: "b", techSignals: ["TypeScript"], repoUpdatedAt: RECENT }),
    ]);
    expect(result.find((t) => t.technology === "TypeScript")?.strength).toBe("strong");
  });

  it("scores 'moderate' when only one of repetition/recency holds", () => {
    const recentOnce = deriveTechnologyObservations([repo({ techSignals: ["Go"], repoUpdatedAt: RECENT })]);
    expect(recentOnce.find((t) => t.technology === "Go")?.strength).toBe("moderate");

    const repeatedButOld = deriveTechnologyObservations([
      repo({ name: "a", techSignals: ["Ruby"], repoUpdatedAt: OLD }),
      repo({ name: "b", techSignals: ["Ruby"], repoUpdatedAt: OLD }),
    ]);
    expect(repeatedButOld.find((t) => t.technology === "Ruby")?.strength).toBe("moderate");
  });

  it("excludes failed-scan repos from every observation", () => {
    const result = deriveTechnologyObservations([repo({ techSignals: ["Rust"], scanStatus: "failed" })]);
    expect(result).toEqual([]);
  });
});
