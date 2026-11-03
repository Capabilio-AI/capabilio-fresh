import { describe, expect, it } from "vitest";
import { deriveScoreBreakdown } from "./score-breakdown";
import { summarizeCalendar, type ActivitySummary } from "./github-profile";
import type { FullRepoAnalysis } from "./github-scan";
import type { OriginalityReport } from "./originality";

const repo = (o: Partial<FullRepoAnalysis> = {}): FullRepoAnalysis => ({
  name: "r", fullName: "u/r", owner: "u", htmlUrl: "", description: null, isFork: false, forkSourceFullName: null, forkSourceUrl: null,
  primaryLanguage: null, languages: [], topics: [], license: null, stars: 0, forksCount: 0, isArchived: false, sizeKb: 100,
  repoCreatedAt: null, repoUpdatedAt: null, candidateCommitCount: 30, candidatePrCount: 0, candidatePrMergedCount: 0,
  firstCandidateCommitAt: null, lastCandidateCommitAt: null, authorshipSample: 1, techSignals: [], hasTests: true, hasCi: true,
  hasReadme: true, hasDependencies: true, hasDatabaseSignal: false, hasAuthSignal: false, contributorsCount: 1, topContributors: [],
  scanStatus: "ok", scanError: null, ...o,
});

const calendar = Array.from({ length: 364 }, (_, i) => (i % 2 === 0 ? 3 : 0));
const activity: ActivitySummary = {
  windowFrom: "", windowTo: "", totalContributions: 546, commits: 400, pullRequests: 30, reviews: 12, issues: 4, privateContributions: 0,
  ...summarizeCalendar(calendar), calendar, calendarStart: "2025-01-05", externalPullRequests: { opened: 6, merged: 5, repositories: 3 },
};
const account = { login: "u", name: null, avatarUrl: "", createdAt: "2022-01-01T00:00:00Z", followers: 0, following: 0, publicRepos: 3, company: null, location: null };
const now = new Date("2026-01-01").getTime();

const match = (level: "high" | "moderate") => ({
  repoName: "r", matchedRepoFullName: "o/x", matchedRepoUrl: "", level, identicalFiles: 9, nearFiles: 0, comparedFiles: 12, nearCopyProbes: 0,
  matchedRepoCreatedAt: "", matchedRepoStars: 0, explanations: [],
});
const report = (matches: OriginalityReport["matches"]): OriginalityReport => ({ status: "checked", eligibleRepos: 1, checkedRepos: 1, matches, copiedByOthers: [], ranAt: "" });

describe("deriveScoreBreakdown", () => {
  it("scores a strong, consistent, original profile highly", () => {
    const b = deriveScoreBreakdown({ repos: [repo(), repo({ name: "r2" })], account, activity, forensics: [], originality: report([]), now });
    expect(b.basis).toBe("full");
    expect(b.overall).toBeGreaterThanOrEqual(80);
    expect(b.parts.map((p) => p.key)).toEqual(["activity", "originality", "collaboration", "practice", "consistency"]);
  });

  it("drops originality when a high overlap is found, and only originality", () => {
    const clean = deriveScoreBreakdown({ repos: [repo()], account, activity, forensics: [], originality: report([]), now });
    const flagged = deriveScoreBreakdown({ repos: [repo()], account, activity, forensics: [], originality: report([match("high")]), now });
    const score = (b: typeof clean, key: string) => b.parts.find((p) => p.key === key)?.score;
    expect(score(flagged, "originality")).toBeLessThan(score(clean, "originality") as number);
    expect(score(flagged, "activity")).toBe(score(clean, "activity"));
  });

  it("falls back to repo data when there is no contribution calendar", () => {
    const b = deriveScoreBreakdown({ repos: [repo()], account: null, activity: null, forensics: [], originality: null, now });
    expect(b.basis).toBe("repos-only");
    expect(b.parts.find((p) => p.key === "consistency")?.score).toBe(0);
  });

  it("keeps every score within 0-100", () => {
    const b = deriveScoreBreakdown({ repos: [repo()], account, activity, forensics: [], originality: report([match("high"), match("high"), match("high")]), now });
    for (const p of [b, ...b.parts]) expect("score" in p ? p.score : p.overall).toBeGreaterThanOrEqual(0);
  });
});
