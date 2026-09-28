import type { FullRepoAnalysis } from "./github-scan";

export type PracticeState = "observed" | "not_observed";

export interface PracticeEvidence {
  repoName: string;
  repoUrl: string;
  detail: string;
}

export interface PracticeSignal {
  practice: string;
  state: PracticeState;
  evidence: PracticeEvidence[];
}

/**
 * Only practices with a real, cheaply-verifiable, unambiguous GitHub
 * signal are included. "Code review" and "issue tracking" were
 * considered and deliberately dropped: the only available proxies
 * (`has_issues`, a repo setting that's on by default and says nothing
 * about actual candidate usage) would be a fabricated-looking signal
 * wearing a real name, which is exactly what this analysis must not do.
 */
export function derivePracticeSignals(repos: FullRepoAnalysis[]): PracticeSignal[] {
  const ok = repos.filter((r) => r.scanStatus !== "failed");

  function signal(practice: string, matches: (r: FullRepoAnalysis) => boolean, detail: (r: FullRepoAnalysis) => string): PracticeSignal {
    const matching = ok.filter(matches);
    return {
      practice,
      state: matching.length > 0 ? "observed" : "not_observed",
      evidence: matching.map((r) => ({ repoName: r.name, repoUrl: r.htmlUrl, detail: detail(r) })),
    };
  }

  return [
    signal("Testing", (r) => r.hasTests, () => "Test directory present"),
    signal("CI/CD", (r) => r.hasCi, () => "CI workflow configuration present"),
    signal(
      "Pull Requests",
      (r) => r.candidatePrCount > 0,
      (r) => `${r.candidatePrCount} pull request${r.candidatePrCount === 1 ? "" : "s"} opened, ${r.candidatePrMergedCount} merged`
    ),
    signal("Documentation", (r) => r.hasReadme, () => "README present"),
    signal("Dependency Management", (r) => r.hasDependencies, () => "Declared dependency manifest present"),
  ];
}
