import { describe, expect, it } from "vitest";
import { buildRecruiterSummary } from "./recruiter-summary";
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
    repoCreatedAt: null,
    repoUpdatedAt: null,
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

describe("buildRecruiterSummary", () => {
  it("is entirely deterministic and template-built — no banned trust-language words ever appear", () => {
    const summary = buildRecruiterSummary("student", [repo({ techSignals: ["TypeScript"] })], []);
    for (const banned of ["genuine", "did not copy", "definitely", "plagiar", "expert"]) {
      expect(summary.toLowerCase()).not.toContain(banned);
    }
  });

  it("says so honestly when there is no evidence, never a fabricated positive summary", () => {
    expect(buildRecruiterSummary("student", [], [])).toContain("No public repository evidence available");
  });

  it("mentions the primary technologies when present", () => {
    const summary = buildRecruiterSummary("student", [repo({})], [
      { technology: "Go", strength: "strong", repoCount: 3, mostRecentAt: null },
    ]);
    expect(summary).toContain("Go");
  });
});
