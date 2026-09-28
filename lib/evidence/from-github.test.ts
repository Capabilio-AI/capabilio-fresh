import { describe, expect, it } from "vitest";
import { deriveGithubEvidence } from "./from-github";
import type { FullRepoAnalysis } from "@/lib/code-dna/github-scan";

function repo(overrides: Partial<FullRepoAnalysis> = {}): FullRepoAnalysis {
  return {
    name: "repo",
    fullName: "student/repo",
    owner: "student",
    htmlUrl: "https://github.com/student/repo",
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
    repoUpdatedAt: "2026-06-01T00:00:00Z",
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
    topContributors: [],
    scanStatus: "ok",
    scanError: null,
    ...overrides,
  };
}

describe("deriveGithubEvidence", () => {
  it("produces one technology_usage row per matched category, each with a real verifiable URL", () => {
    const rows = deriveGithubEvidence([repo({ techSignals: ["TypeScript", "Node.js"] })]);
    const categories = rows.filter((r) => r.evidenceType === "technology_usage").map((r) => r.skill);
    expect(categories).toEqual(expect.arrayContaining(["Programming", "Frontend Engineering", "Backend Engineering"]));
    for (const row of rows) {
      expect(row.sourceUrl).toBe("https://github.com/student/repo");
    }
  });

  it("produces a commit_activity row only when the candidate has real commits on the repo", () => {
    const withCommits = deriveGithubEvidence([repo({ candidateCommitCount: 12 })]);
    expect(withCommits.some((r) => r.evidenceType === "commit_activity")).toBe(true);

    const withoutCommits = deriveGithubEvidence([repo({ candidateCommitCount: 0 })]);
    expect(withoutCommits.some((r) => r.evidenceType === "commit_activity")).toBe(false);
  });

  it("still produces commit_activity evidence for a fork with real candidate commits -- forks are not zeroed out", () => {
    const rows = deriveGithubEvidence([repo({ isFork: true, candidateCommitCount: 42 })]);
    const activity = rows.find((r) => r.evidenceType === "commit_activity");
    expect(activity?.metadata.commits).toBe(42);
    expect(activity?.metadata.isFork).toBe(true);
  });

  it("produces no evidence for a repo whose scan failed -- never fabricates evidence from a failed scan", () => {
    const rows = deriveGithubEvidence([repo({ scanStatus: "failed", techSignals: ["TypeScript"], candidateCommitCount: 5 })]);
    expect(rows).toEqual([]);
  });

  it("gives higher confidence to a repo with more candidate commits", () => {
    const low = deriveGithubEvidence([repo({ candidateCommitCount: 1 })]).find((r) => r.evidenceType === "commit_activity");
    const high = deriveGithubEvidence([repo({ candidateCommitCount: 10 })]).find((r) => r.evidenceType === "commit_activity");
    expect(low?.confidence).toBe("low");
    expect(high?.confidence).toBe("high");
  });

  it("uses a stable source_identifier per (repo, category) so a rescan replaces rather than duplicates", () => {
    const rows = deriveGithubEvidence([repo({ techSignals: ["TypeScript"] })]);
    const programming = rows.find((r) => r.skill === "Programming");
    expect(programming?.sourceIdentifier).toBe("github:student/repo:Programming");
  });
});
