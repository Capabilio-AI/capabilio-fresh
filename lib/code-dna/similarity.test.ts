import { describe, expect, it } from "vitest";
import { classifyNameCollision, eligibleForSimilarityCheck } from "./similarity";
import type { FullRepoAnalysis } from "./github-scan";

function repo(overrides: Partial<FullRepoAnalysis>): FullRepoAnalysis {
  return {
    name: "my-project",
    fullName: "user/my-project",
    owner: "user",
    htmlUrl: "https://github.com/user/my-project",
    description: null,
    isFork: false,
    forkSourceFullName: null,
    forkSourceUrl: null,
    primaryLanguage: "TypeScript",
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

describe("classifyNameCollision", () => {
  it("never produces 'high' similarity — that requires a stronger method than this MVP implements", () => {
    const result = classifyNameCollision(repo({}), { fullName: "other/my-project", htmlUrl: "https://github.com/other/my-project", language: "TypeScript" });
    expect(result?.similarityLevel).not.toBe("high");
  });

  it("suppresses a generic project name unless the language also matches", () => {
    const generic = repo({ name: "todo-app", primaryLanguage: "JavaScript" });
    const noLanguageMatch = classifyNameCollision(generic, { fullName: "other/todo-app", htmlUrl: "https://github.com/other/todo-app", language: "Python" });
    expect(noLanguageMatch).toBeNull();
  });

  it("only reaches 'moderate' for a non-generic name with a matching language", () => {
    const result = classifyNameCollision(repo({ name: "my-distinctive-capstone", primaryLanguage: "Go" }), {
      fullName: "other/my-distinctive-capstone",
      htmlUrl: "https://github.com/other/my-distinctive-capstone",
      language: "Go",
    });
    expect(result?.similarityLevel).toBe("moderate");
  });

  it("never writes accusation or certainty language in possibleExplanations", () => {
    const result = classifyNameCollision(repo({ name: "my-distinctive-capstone", primaryLanguage: "Go" }), {
      fullName: "other/my-distinctive-capstone",
      htmlUrl: "https://github.com/other/my-distinctive-capstone",
      language: "Go",
    });
    const text = result?.possibleExplanations.join(" ").toLowerCase() ?? "";
    expect(text).not.toContain("plagiar");
    expect(text).not.toContain("definitely");
    expect(text).not.toContain("stole");
  });
});

describe("eligibleForSimilarityCheck", () => {
  it("excludes forks, archived, and failed-scan repos — never bulk-compares blindly", () => {
    expect(eligibleForSimilarityCheck(repo({ isFork: true }))).toBe(false);
    expect(eligibleForSimilarityCheck(repo({ isArchived: true }))).toBe(false);
    expect(eligibleForSimilarityCheck(repo({ scanStatus: "failed" }))).toBe(false);
    expect(eligibleForSimilarityCheck(repo({}))).toBe(true);
  });
});
