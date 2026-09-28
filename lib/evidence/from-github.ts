import type { FullRepoAnalysis } from "@/lib/code-dna/github-scan";
import { BACKEND_TECH, DEVOPS_TECH, FRONTEND_TECH, type CapabilityCategory } from "@/lib/code-dna/capability-derivation";
import { confidenceFor } from "@/lib/capability/confidence";
import type { EvidenceRow } from "./types";

export const CODE_DNA_ANALYSIS_VERSION = "code-dna.v1";

// Same category matchers as capability-derivation.ts's GITHUB_CATEGORY_MATCHERS,
// operating on FullRepoAnalysis directly (structurally incompatible with the
// legacy RepoAnalysis type that module exports, since FullRepoAnalysis lacks
// authorCommitShare) -- the underlying tech-category sets are still shared,
// not re-declared, so the two can't silently drift on what counts as
// "frontend" or "backend".
const CATEGORY_MATCHERS: Partial<Record<CapabilityCategory, (repo: FullRepoAnalysis) => boolean>> = {
  Programming: (r) => r.techSignals.length > 0,
  "Frontend Engineering": (r) => r.techSignals.some((t) => FRONTEND_TECH.has(t)),
  "Backend Engineering": (r) => r.techSignals.some((t) => BACKEND_TECH.has(t)),
  Testing: (r) => r.hasTests,
  "DevOps/Infrastructure": (r) => r.techSignals.some((t) => DEVOPS_TECH.has(t)),
};

/**
 * Pure — one technology_usage evidence row per (repo, matched category),
 * one commit_activity row per repo with real candidate commits. Each row
 * is individually verifiable (a real repo URL) and individually replaced
 * on rescan via the (user_id, source_type, source_identifier) unique
 * index, so a stale category match never lingers after real activity
 * moves away from a repo.
 */
export function deriveGithubEvidence(repos: FullRepoAnalysis[]): EvidenceRow[] {
  const rows: EvidenceRow[] = [];

  for (const repo of repos) {
    if (repo.scanStatus === "failed") continue;

    for (const [category, matches] of Object.entries(CATEGORY_MATCHERS) as [CapabilityCategory, (r: FullRepoAnalysis) => boolean][]) {
      if (!matches(repo)) continue;
      rows.push({
        skill: category,
        evidenceType: "technology_usage",
        sourceIdentifier: `github:${repo.fullName}:${category}`,
        sourceUrl: repo.htmlUrl,
        observedAt: repo.repoUpdatedAt,
        confidence: confidenceFor(1),
        metadata: { repoName: repo.name, isFork: repo.isFork, techSignals: repo.techSignals },
      });
    }

    if (repo.candidateCommitCount > 0) {
      rows.push({
        skill: repo.primaryLanguage ?? "Software Engineering",
        evidenceType: "commit_activity",
        sourceIdentifier: `github:${repo.fullName}:activity`,
        sourceUrl: repo.htmlUrl,
        observedAt: repo.lastCandidateCommitAt,
        confidence: confidenceFor(repo.candidateCommitCount),
        metadata: {
          repoName: repo.name,
          commits: repo.candidateCommitCount,
          pullRequests: repo.candidatePrCount,
          pullRequestsMerged: repo.candidatePrMergedCount,
          isFork: repo.isFork,
        },
      });
    }
  }

  return rows;
}
