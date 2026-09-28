import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { deriveCapabilityProfile, type ArenaProgrammingEvidence } from "@/lib/code-dna/capability-derivation";
import { deriveTechnologyObservations } from "@/lib/code-dna/technology-derivation";
import { derivePracticeSignals } from "@/lib/code-dna/practice-signals";
import { deriveAuthenticityAndReview } from "@/lib/code-dna/authenticity-and-review-signals";
import { rowToFullRepoAnalysis, type GithubScanResult, type RepoAnalysis } from "@/lib/code-dna/github-scan";
import type { Database } from "@/lib/supabase/types";

type RepositoryRow = Database["public"]["Tables"]["github_repositories"]["Row"];
type SimilaritySignalRow = Database["public"]["Tables"]["github_similarity_signals"]["Row"];

/** Adapter only — the Skill Gap capability-derivation module (a separate, already-shipped feature) still reads this shape; it only ever looks at isFork/techSignals/hasTests. */
function toLegacyGithubScanResult(username: string, repos: RepositoryRow[]): GithubScanResult {
  const repoAnalyses: RepoAnalysis[] = repos.map((r) => ({
    name: r.name,
    htmlUrl: r.html_url,
    isFork: r.is_fork,
    stars: r.stars,
    updatedAt: r.repo_updated_at ?? r.scanned_at,
    techSignals: r.tech_signals,
    hasReadme: r.has_readme,
    hasTests: r.has_tests,
    authorCommitShare: null,
  }));
  return {
    username,
    publicRepos: repos.length,
    repositoriesAnalyzed: repos.length,
    repos: repoAnalyses,
    pullRequestsOpened: repos.reduce((sum, r) => sum + r.candidate_pr_count, 0),
    pullRequestsMerged: repos.reduce((sum, r) => sum + r.candidate_pr_merged_count, 0),
  };
}

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  // Every query is user-scoped (RLS: own rows only) regardless of whether
  // a GitHub connection exists — Arena-only evidence is still real Code
  // DNA data for the Skill Gap integration, so it must not depend on
  // GitHub being connected. No live GitHub API call happens here — this
  // route only ever reads what a prior scan already stored.
  const [{ data: connection }, { data: repoRows }, { data: arenaAttempts }] = await Promise.all([
    supabase
      .from("github_connections")
      .select(
        "username, profile_url, verification_state, verification_code, scan_status, code_dna_score, repositories_analyzed, recruiter_summary, last_scanned_at, next_scan_at, last_scan_error"
      )
      .eq("user_id", auth.userId)
      .maybeSingle(),
    supabase
      .from("github_repositories")
      .select("*")
      .eq("user_id", auth.userId)
      .order("stars", { ascending: false }),
    supabase
      .from("arena_challenge_attempts")
      .select("correct_count, answered_count, completed_at")
      .eq("user_id", auth.userId)
      .eq("section", "programming_fundamentals")
      .eq("status", "completed"),
  ]);

  const repos = repoRows ?? [];
  const repoIds = repos.map((r) => r.id);
  const { data: similarityRows } = repoIds.length
    ? await supabase.from("github_similarity_signals").select("*").in("repository_id", repoIds)
    : { data: [] as SimilaritySignalRow[] };

  const arenaProgrammingEvidence: ArenaProgrammingEvidence[] = (arenaAttempts ?? []).map((a) => ({
    correctCount: a.correct_count,
    answeredCount: a.answered_count,
    completedAt: a.completed_at as string,
  }));

  const legacyGithubScan = connection ? toLegacyGithubScanResult(connection.username, repos) : null;
  const capabilityProfile = deriveCapabilityProfile(legacyGithubScan, connection?.last_scanned_at ?? null, arenaProgrammingEvidence);

  if (!connection) {
    return NextResponse.json({ connected: false, capabilityProfile, arenaAttemptCount: arenaProgrammingEvidence.length });
  }

  const canScanNow =
    connection.verification_state === "verified" &&
    connection.scan_status !== "scanning" &&
    (!connection.next_scan_at || new Date(connection.next_scan_at) <= new Date());

  const fullRepos = repos.map(rowToFullRepoAnalysis);
  const technologies = repos.length > 0 ? deriveTechnologyObservations(fullRepos) : [];
  const practices = repos.length > 0 ? derivePracticeSignals(fullRepos) : [];
  const { authenticitySignals, reviewSignals } = repos.length > 0 ? deriveAuthenticityAndReview(fullRepos) : { authenticitySignals: [], reviewSignals: [] };

  const hasPartialCoverage = repos.some((r) => r.scan_status !== "ok");

  return NextResponse.json({
    connected: true,
    username: connection.username,
    profileUrl: connection.profile_url,
    verificationState: connection.verification_state,
    verificationCode: connection.verification_code,
    scanStatus: connection.scan_status,
    evidenceConfidence: connection.code_dna_score,
    repositoriesAnalyzed: connection.repositories_analyzed,
    recruiterSummary: connection.recruiter_summary,
    lastScannedAt: connection.last_scanned_at,
    nextScanAt: connection.next_scan_at,
    lastScanError: connection.last_scan_error,
    canScanNow,
    hasPartialCoverage,
    repositories: repos.map((r) => ({
      name: r.name,
      fullName: r.full_name,
      owner: r.full_name.split("/")[0],
      htmlUrl: r.html_url,
      description: r.description,
      isFork: r.is_fork,
      forkSourceFullName: r.fork_source_full_name,
      forkSourceUrl: r.fork_source_url,
      primaryLanguage: r.primary_language,
      languages: r.languages,
      topics: r.topics,
      license: r.license,
      stars: r.stars,
      forksCount: r.forks_count,
      isArchived: r.is_archived,
      sizeKb: r.size_kb,
      repoCreatedAt: r.repo_created_at,
      repoUpdatedAt: r.repo_updated_at,
      candidateCommitCount: r.candidate_commit_count,
      candidatePrCount: r.candidate_pr_count,
      candidatePrMergedCount: r.candidate_pr_merged_count,
      firstCandidateCommitAt: r.first_candidate_commit_at,
      lastCandidateCommitAt: r.last_candidate_commit_at,
      techSignals: r.tech_signals,
      hasTests: r.has_tests,
      hasCi: r.has_ci,
      hasReadme: r.has_readme,
      hasDependencies: r.has_dependencies,
      hasDatabaseSignal: r.has_database_signal,
      hasAuthSignal: r.has_auth_signal,
      contributorsCount: r.contributors_count,
      topContributors: r.top_contributors,
      scanStatus: r.scan_status,
      similaritySignals: (similarityRows ?? [])
        .filter((s) => s.repository_id === r.id)
        .map((s) => ({
          matchedRepoFullName: s.matched_repo_full_name,
          matchedRepoUrl: s.matched_repo_url,
          similarityLevel: s.similarity_level,
          affectedArea: s.affected_area,
          possibleExplanations: s.possible_explanations,
        })),
    })),
    technologies,
    practices,
    authenticitySignals,
    reviewSignals,
    capabilityProfile,
    arenaAttemptCount: arenaProgrammingEvidence.length,
  });
}
