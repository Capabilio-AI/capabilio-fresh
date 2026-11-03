import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { AccountFacts, ActivitySummary } from "@/lib/code-dna/github-profile";
import type { ForensicSignal } from "@/lib/code-dna/commit-forensics";
import type { OriginalityReport } from "@/lib/code-dna/originality";
import type { ScoreBreakdown } from "@/lib/code-dna/score-breakdown";
import { deriveAuthenticityAndReview } from "@/lib/code-dna/authenticity-and-review-signals";
import { rowToFullRepoAnalysis } from "@/lib/code-dna/github-scan";
import { DEFENDED_SCORE } from "@/lib/code-dna/defend-repo";

const TOP_REPOS = 3;
const MAX_LANGUAGES = 5;
const MAX_NOTES = 3;

/** Everything a recruiter would otherwise open GitHub to find, from one stored scan. */
export interface GithubEvidence {
  username: string;
  profileUrl: string;
  verified: boolean;
  repositoriesAnalyzed: number | null;
  lastScannedAt: string | null;
  score: number | null;
  breakdown: ScoreBreakdown | null;
  account: AccountFacts | null;
  activity: ActivitySummary | null;
  originality: { status: OriginalityReport["status"]; checkedRepos: number; overlaps: number; copiedByOthers: number } | null;
  topRepos: { name: string; url: string; description: string | null; language: string | null; stars: number; commits: number; explainedScore: number | null }[];
  languages: { name: string; percentage: number }[];
  summary: string | null;
  /** Neutral, factual notes -- both what supports authenticity and what a reviewer may want to check. */
  positiveNotes: string[];
  reviewNotes: string[];
}

type ConnectionRow = Pick<
  Database["public"]["Tables"]["github_connections"]["Row"],
  "username" | "profile_url" | "verification_state" | "repositories_analyzed" | "last_scanned_at" | "code_dna_score" | "score_breakdown" | "account_facts" | "activity" | "originality" | "recruiter_summary"
>;

export const GITHUB_CONNECTION_COLUMNS =
  "username, profile_url, verification_state, repositories_analyzed, last_scanned_at, code_dna_score, score_breakdown, account_facts, activity, originality, recruiter_summary";

/** Pure. Languages weighted by repository size, so one huge repo outweighs ten tiny ones. */
export function aggregateLanguages(repos: { sizeKb: number; languages: { name: string; percentage: number }[] }[]): { name: string; percentage: number }[] {
  const weight = new Map<string, number>();
  for (const r of repos) for (const l of r.languages) weight.set(l.name, (weight.get(l.name) ?? 0) + (l.percentage / 100) * Math.max(r.sizeKb, 1));
  const total = [...weight.values()].reduce((sum, w) => sum + w, 0);
  if (total === 0) return [];
  return [...weight.entries()]
    .map(([name, w]) => ({ name, percentage: Math.round((w / total) * 1000) / 10 }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, MAX_LANGUAGES);
}

export async function loadGithubEvidence(supabase: SupabaseClient<Database>, userId: string, connection: ConnectionRow | null): Promise<GithubEvidence | null> {
  if (!connection) return null;
  const { data: repoRows } = await supabase.from("github_repositories").select("*").eq("user_id", userId);
  const rows = repoRows ?? [];
  const { data: defenseRows } = await supabase.from("github_repo_defenses").select("full_name, score").eq("user_id", userId);
  const explained = new Map((defenseRows ?? []).filter((d) => d.score !== null && d.score >= DEFENDED_SCORE).map((d) => [d.full_name, d.score as number]));
  const repos = rows.map(rowToFullRepoAnalysis);
  const { authenticitySignals, reviewSignals } = repos.length ? deriveAuthenticityAndReview(repos) : { authenticitySignals: [], reviewSignals: [] };

  const forensics = rows.flatMap((r) => ((r.commit_signals ?? []) as ForensicSignal[]).map((f) => ({ ...f, repo: r.name })));
  const originality = connection.originality as OriginalityReport | null;
  const positiveNotes = [
    ...authenticitySignals.map((s) => s.signal),
    ...forensics.filter((f) => f.tone === "positive").map((f) => `${f.signal} in ${f.repo}`),
    ...[...explained.keys()].slice(0, 2).map((n) => `Explained ${n.split("/")[1]} in their own words`),
    ...(originality?.copiedByOthers.length ? ["Other public repositories copied files from this profile's work"] : []),
  ];
  const reviewNotes = [
    ...reviewSignals.map((s) => s.signal),
    ...forensics.filter((f) => f.tone === "review").map((f) => `${f.signal} in ${f.repo}`),
    ...(originality?.matches.map((m) => `${m.repoName} shares ${m.identicalFiles + (m.nearFiles ?? 0)} of ${m.comparedFiles} source files with ${m.matchedRepoFullName}`) ?? []),
  ];

  return {
    username: connection.username,
    profileUrl: connection.profile_url,
    verified: connection.verification_state === "verified",
    repositoriesAnalyzed: connection.repositories_analyzed,
    lastScannedAt: connection.last_scanned_at,
    score: connection.code_dna_score,
    breakdown: connection.score_breakdown as ScoreBreakdown | null,
    account: connection.account_facts as AccountFacts | null,
    activity: connection.activity as ActivitySummary | null,
    originality: originality
      ? { status: originality.status, checkedRepos: originality.checkedRepos, overlaps: originality.matches.length, copiedByOthers: originality.copiedByOthers.length }
      : null,
    topRepos: repos
      .filter((r) => !r.isFork && r.scanStatus !== "failed")
      .sort((a, b) => b.stars - a.stars || b.candidateCommitCount - a.candidateCommitCount)
      .slice(0, TOP_REPOS)
      .map((r) => ({ name: r.name, url: r.htmlUrl, description: r.description, language: r.primaryLanguage, stars: r.stars, commits: r.candidateCommitCount, explainedScore: explained.get(r.fullName) ?? null })),
    languages: aggregateLanguages(repos),
    summary: connection.recruiter_summary,
    positiveNotes: positiveNotes.slice(0, MAX_NOTES),
    reviewNotes: reviewNotes.slice(0, MAX_NOTES),
  };
}
