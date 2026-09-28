import { describe, expect, it } from "vitest";
import { derivePracticeSignals } from "./practice-signals";
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

describe("derivePracticeSignals", () => {
  it("marks a practice 'observed' with real per-repo evidence when at least one repo shows it", () => {
    const result = derivePracticeSignals([repo({ name: "tested-repo", hasTests: true })]);
    const testing = result.find((p) => p.practice === "Testing");
    expect(testing?.state).toBe("observed");
    expect(testing?.evidence).toEqual([{ repoName: "tested-repo", repoUrl: "https://github.com/user/repo", detail: "Test directory present" }]);
  });

  it("marks a practice 'not_observed' when no repo shows it", () => {
    const result = derivePracticeSignals([repo({ hasTests: false })]);
    expect(result.find((p) => p.practice === "Testing")?.state).toBe("not_observed");
  });

  it("excludes failed-scan repos from evidence", () => {
    const result = derivePracticeSignals([repo({ hasTests: true, scanStatus: "failed" })]);
    expect(result.find((p) => p.practice === "Testing")?.state).toBe("not_observed");
  });

  it("never claims 'Code Review' or 'Issue Tracking' as a practice — no reliable signal exists for them", () => {
    const result = derivePracticeSignals([repo({})]);
    const practiceNames = result.map((p) => p.practice);
    expect(practiceNames).not.toContain("Code Review");
    expect(practiceNames).not.toContain("Issue Tracking");
  });
});
