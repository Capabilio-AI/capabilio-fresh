import { describe, expect, it } from "vitest";
import { buildEvidenceProfile } from "./evidence-profile";
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

function scan(repos: RepoAnalysis[], overrides: Partial<GithubScanResult> = {}): GithubScanResult {
  return {
    username: "student",
    publicRepos: repos.length,
    repositoriesAnalyzed: repos.length,
    repos,
    pullRequestsOpened: 0,
    pullRequestsMerged: 0,
    ...overrides,
  };
}

describe("buildEvidenceProfile", () => {
  it("buckets known tech signals into frontend/backend/devops and de-duplicates across repos", () => {
    const profile = buildEvidenceProfile(
      scan([
        repo({ name: "a", techSignals: ["TypeScript", "Node.js"] }),
        repo({ name: "b", techSignals: ["Node.js", "Docker"] }),
      ])
    );
    expect(profile.technicalFootprint.frontend).toEqual(["TypeScript"]);
    expect(profile.technicalFootprint.backend).toEqual(["Node.js"]);
    expect(profile.technicalFootprint.devops).toEqual(["Docker"]);
  });

  it("separates original work from forks in authorship evidence", () => {
    const profile = buildEvidenceProfile(
      scan([repo({ name: "a", isFork: false }), repo({ name: "b", isFork: true }), repo({ name: "c", isFork: false })])
    );
    expect(profile.authorshipEvidence.originalRepoCount).toBe(2);
    expect(profile.authorshipEvidence.forkedRepoCount).toBe(1);
  });

  it("averages authorship share only across repos where it was actually measured", () => {
    const profile = buildEvidenceProfile(
      scan([
        repo({ name: "a", authorCommitShare: 1.0 }),
        repo({ name: "b", authorCommitShare: 0.4 }),
        repo({ name: "c", isFork: true, authorCommitShare: null }),
      ])
    );
    expect(profile.authorshipEvidence.averageAuthorshipShare).toBeCloseTo(0.7);
  });

  it("reports engineering-practice states correctly: observed, not_observed, and not_available", () => {
    const withTests = buildEvidenceProfile(scan([repo({ hasTests: true }), repo({ hasTests: false })]));
    expect(withTests.engineeringPractice.testing).toBe("observed");

    const withoutTests = buildEvidenceProfile(scan([repo({ hasTests: false })]));
    expect(withoutTests.engineeringPractice.testing).toBe("not_observed");

    const noRepos = buildEvidenceProfile(scan([], { repositoriesAnalyzed: 0 }));
    expect(noRepos.engineeringPractice.testing).toBe("not_available");
  });

  it("never claims a similarity/plagiarism check ran — limitations always disclose that", () => {
    const profile = buildEvidenceProfile(scan([repo({})]));
    expect(profile.limitations.some((l) => l.toLowerCase().includes("plagiarism"))).toBe(true);
  });

  it("passes collaboration evidence through unchanged, real numbers only", () => {
    const profile = buildEvidenceProfile(scan([], { pullRequestsOpened: 12, pullRequestsMerged: 5 }));
    expect(profile.collaborationEvidence).toEqual({ pullRequestsOpened: 12, pullRequestsMerged: 5 });
  });
});
