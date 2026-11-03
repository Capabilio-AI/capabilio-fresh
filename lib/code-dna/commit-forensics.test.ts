import { describe, expect, it } from "vitest";
import { analyzeCommitHistory, type CommitSample } from "./commit-forensics";

const commit = (date: string, message = "add the login form validation and error states"): CommitSample => ({ message, authoredAt: `${date}T10:00:00Z` });
const names = (signals: { signal: string }[]) => signals.map((s) => s.signal);

describe("analyzeCommitHistory", () => {
  it("flags a bulk first commit on a tiny history", () => {
    const signals = analyzeCommitHistory({
      repoCreatedAt: "2026-03-01T00:00:00Z",
      totalCommits: 2,
      commits: [commit("2026-03-02"), commit("2026-03-01")],
      firstCommit: { fileCount: 120, additions: 9000 },
    });
    expect(names(signals)).toContain("Project arrived as a bulk upload");
  });

  it("does not run the dump check on a long history", () => {
    const signals = analyzeCommitHistory({
      repoCreatedAt: "2026-03-01T00:00:00Z",
      totalCommits: 400,
      commits: [commit("2026-03-02")],
      firstCommit: { fileCount: 120, additions: 9000 },
    });
    expect(names(signals)).not.toContain("Project arrived as a bulk upload");
  });

  it("flags history dated before the repository existed", () => {
    const signals = analyzeCommitHistory({ repoCreatedAt: "2026-06-01T00:00:00Z", totalCommits: 3, commits: [commit("2026-02-01")], firstCommit: null });
    expect(names(signals)).toContain("Commit history predates the repository");
  });

  it("flags one-day bursts and generic messages", () => {
    const commits = Array.from({ length: 12 }, () => commit("2026-04-01", "update"));
    const signals = names(analyzeCommitHistory({ repoCreatedAt: null, totalCommits: 12, commits, firstCommit: null }));
    expect(signals).toContain("All commits on a single day");
    expect(signals).toContain("Mostly generic commit messages");
  });

  it("credits incremental work with descriptive messages", () => {
    const commits = Array.from({ length: 20 }, (_, i) => commit(`2026-04-${String(i + 1).padStart(2, "0")}`));
    const signals = names(analyzeCommitHistory({ repoCreatedAt: "2026-03-30T00:00:00Z", totalCommits: 20, commits, firstCommit: null }));
    expect(signals).toContain("Built up incrementally");
    expect(signals).toContain("Descriptive commit messages");
  });

  it("returns nothing when there are no commits", () => {
    expect(analyzeCommitHistory({ repoCreatedAt: null, totalCommits: 0, commits: [], firstCommit: null })).toEqual([]);
  });
});
