import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { MAX_REPOS_TO_ANALYZE, scanGithubProfileFull, searchRepositoriesByName } from "@/lib/code-dna/github-scan";
import { selectSignificantRepositories } from "@/lib/code-dna/github-repository-selection";
import { deriveTechnologyObservations } from "@/lib/code-dna/technology-derivation";
import { deriveAuthenticityAndReview } from "@/lib/code-dna/authenticity-and-review-signals";
import { buildRecruiterSummary } from "@/lib/code-dna/recruiter-summary";
import { classifyNameCollision, eligibleForSimilarityCheck } from "@/lib/code-dna/similarity";

const SCAN_COOLDOWN_MINUTES = 15;
const MAX_SIMILARITY_LOOKUPS = 3;

/**
 * Runs a real, multi-repo scan and persists normalized per-repository
 * evidence — no AI involvement anywhere in this route. Claims the
 * connection row atomically (scan_status: idle|failed -> scanning, only
 * when off cooldown) so two concurrent requests can't both scan it.
 * One repository failing never fails the whole scan: each
 * github_repositories row carries its own scan_status.
 */
export async function POST() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "code_dna_scan", maxRequests: 6, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const service = createServiceClient();

  const { data: connection } = await service
    .from("github_connections")
    .select("username, verification_state, scan_status, next_scan_at, consecutive_failures")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: "Connect a GitHub username first." }, { status: 404 });
  }
  if (connection.verification_state !== "verified") {
    return NextResponse.json({ error: "Verify your GitHub bio before scanning." }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { data: claimed } = await service
    .from("github_connections")
    .update({ scan_status: "scanning" })
    .eq("user_id", auth.userId)
    .in("scan_status", ["idle", "failed"])
    .or(`next_scan_at.is.null,next_scan_at.lte.${nowIso}`)
    .select("username")
    .maybeSingle();

  if (!claimed) {
    return NextResponse.json(
      { error: "A scan is already running, or you're still on cooldown — try again shortly." },
      { status: 409 }
    );
  }

  try {
    const scan = await scanGithubProfileFull(connection.username, (repos) =>
      selectSignificantRepositories(repos, MAX_REPOS_TO_ANALYZE)
    );

    // Replace-on-rescan: this user's previous repository rows (and their
    // similarity signals, via cascade delete) are removed before the
    // fresh set is inserted, so a rescan can't leave stale repos behind.
    await service.from("github_repositories").delete().eq("user_id", auth.userId);

    const { data: insertedRepos, error: insertError } = await service
      .from("github_repositories")
      .insert(
        scan.repositories.map((r) => ({
          user_id: auth.userId,
          name: r.name,
          full_name: r.fullName,
          html_url: r.htmlUrl,
          description: r.description,
          is_fork: r.isFork,
          fork_source_full_name: r.forkSourceFullName,
          fork_source_url: r.forkSourceUrl,
          primary_language: r.primaryLanguage,
          languages: r.languages,
          topics: r.topics,
          license: r.license,
          stars: r.stars,
          forks_count: r.forksCount,
          is_archived: r.isArchived,
          size_kb: r.sizeKb,
          repo_created_at: r.repoCreatedAt,
          repo_updated_at: r.repoUpdatedAt,
          candidate_commit_count: r.candidateCommitCount,
          candidate_pr_count: r.candidatePrCount,
          candidate_pr_merged_count: r.candidatePrMergedCount,
          first_candidate_commit_at: r.firstCandidateCommitAt,
          last_candidate_commit_at: r.lastCandidateCommitAt,
          tech_signals: r.techSignals,
          has_tests: r.hasTests,
          has_ci: r.hasCi,
          has_readme: r.hasReadme,
          has_dependencies: r.hasDependencies,
          has_database_signal: r.hasDatabaseSignal,
          has_auth_signal: r.hasAuthSignal,
          contributors_count: r.contributorsCount,
          top_contributors: r.topContributors,
          scan_status: r.scanStatus,
          scan_error: r.scanError,
        }))
      )
      .select("id, name, is_fork, is_archived, scan_status, primary_language");
    if (insertError) throw insertError;

    // Similarity: bounded, only eligible (non-fork, non-archived, real
    // scan) repos, capped independently of the main scan budget — never
    // bulk-compares. A name collision is only ever surfaced as low/
    // moderate (see similarity.ts); this pass never produces "high".
    const eligibleRepos = scan.repositories.filter(eligibleForSimilarityCheck).slice(0, MAX_SIMILARITY_LOOKUPS);
    for (const repo of eligibleRepos) {
      const insertedRow = insertedRepos?.find((r) => r.name === repo.name);
      if (!insertedRow) continue;
      const matches = await searchRepositoriesByName(repo.name, connection.username);
      const signals = matches.map((m) => classifyNameCollision(repo, m)).filter((s) => s !== null);
      if (signals.length > 0) {
        await service.from("github_similarity_signals").insert(
          signals.map((s) => ({
            repository_id: insertedRow.id,
            matched_repo_full_name: s.matchedRepoFullName,
            matched_repo_url: s.matchedRepoUrl,
            similarity_level: s.similarityLevel,
            affected_area: s.affectedArea,
            possible_explanations: s.possibleExplanations,
          }))
        );
      }
    }

    const okRepos = scan.repositories.filter((r) => r.scanStatus !== "failed");
    const technologies = deriveTechnologyObservations(scan.repositories);
    const { evidenceConfidence } = deriveAuthenticityAndReview(scan.repositories);
    const recruiterSummary = buildRecruiterSummary(connection.username, scan.repositories, technologies);

    await service
      .from("github_connections")
      .update({
        scan_status: "idle",
        code_dna_score: evidenceConfidence,
        confidence_level: null,
        repositories_analyzed: okRepos.length,
        analysis: null,
        recruiter_summary: recruiterSummary,
        last_scanned_at: new Date().toISOString(),
        next_scan_at: new Date(Date.now() + SCAN_COOLDOWN_MINUTES * 60_000).toISOString(),
        consecutive_failures: 0,
        last_scan_error: null,
      })
      .eq("user_id", auth.userId);

    return NextResponse.json({ evidenceConfidence, repositoriesAnalyzed: okRepos.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    console.error("[code-dna/scan] failed:", message);
    await service
      .from("github_connections")
      .update({
        scan_status: "failed",
        last_scan_error: message,
        next_scan_at: new Date(Date.now() + SCAN_COOLDOWN_MINUTES * 60_000).toISOString(),
        consecutive_failures: connection.consecutive_failures + 1,
      })
      .eq("user_id", auth.userId);
    return NextResponse.json({ error: "Scan failed — try again in a few minutes." }, { status: 502 });
  }
}
