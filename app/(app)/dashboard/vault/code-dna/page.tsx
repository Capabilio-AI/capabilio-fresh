import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  GitFork,
  MinusCircle,
  RefreshCw,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { rowToFullRepoAnalysis } from "@/lib/code-dna/github-scan";
import { deriveTechnologyObservations, type TechnologyObservation } from "@/lib/code-dna/technology-derivation";
import { derivePracticeSignals, type PracticeSignal } from "@/lib/code-dna/practice-signals";
import { deriveAuthenticityAndReview } from "@/lib/code-dna/authenticity-and-review-signals";
import type { Database } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Code DNA — Capabilio AI" };

type RepositoryRow = Database["public"]["Tables"]["github_repositories"]["Row"];
type SimilaritySignalRow = Database["public"]["Tables"]["github_similarity_signals"]["Row"];

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default async function CodeDnaDetailPage() {
  const { supabase, user } = await requireAuthedUser();

  const { data: connection } = await supabase
    .from("github_connections")
    .select("username, profile_url, code_dna_score, recruiter_summary, last_scanned_at, repositories_analyzed")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: repoRows } = await supabase
    .from("github_repositories")
    .select("*")
    .eq("user_id", user.id)
    .order("stars", { ascending: false });

  const repos = repoRows ?? [];
  const repoIds = repos.map((r) => r.id);
  const { data: similarityRows } = repoIds.length
    ? await supabase.from("github_similarity_signals").select("*").in("repository_id", repoIds)
    : { data: [] as SimilaritySignalRow[] };

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/vault" className="flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted hover:text-app-charcoal">
        <ArrowLeft size={12} />
        Back to Vault
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <Building2 size={20} className="text-app-charcoal" />
        <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Code DNA</h1>
      </div>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        A summary of publicly available GitHub evidence — engineering activity, technology usage, and provenance
        signals. Not a score of who you are.
      </p>

      {!connection || repos.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
          <p className="font-lp-body text-[13.5px] text-app-muted">
            Connect and scan your GitHub from the Vault tab to see your evidence breakdown here.
          </p>
        </div>
      ) : (
        <CodeDnaEvidence
          repos={repos}
          similarityRows={similarityRows ?? []}
          evidenceConfidence={connection.code_dna_score}
          recruiterSummary={connection.recruiter_summary}
          username={connection.username}
          profileUrl={connection.profile_url}
          lastScannedAt={connection.last_scanned_at}
          repositoriesAnalyzed={connection.repositories_analyzed}
        />
      )}
    </div>
  );
}

const STRENGTH_LABEL: Record<TechnologyObservation["strength"], string> = {
  strong: "Strong",
  moderate: "Moderate",
  limited: "Limited",
};
const STRENGTH_CLASS: Record<TechnologyObservation["strength"], string> = {
  strong: "bg-app-success-container text-app-success",
  moderate: "bg-app-warning-container text-app-warning",
  limited: "bg-app-attention-container text-app-attention",
};
const PRACTICE_ICON: Record<PracticeSignal["state"], typeof CheckCircle2> = {
  observed: CheckCircle2,
  not_observed: MinusCircle,
};
const SIMILARITY_LABEL: Record<string, string> = {
  low: "Low — no significant similarity detected",
  moderate: "Review recommended: moderate similarity detected with a public repository",
  high: "Review recommended: substantial similarity detected with a public repository",
};

function CodeDnaEvidence({
  repos,
  similarityRows,
  evidenceConfidence,
  recruiterSummary,
  username,
  profileUrl,
  lastScannedAt,
  repositoriesAnalyzed,
}: {
  repos: RepositoryRow[];
  similarityRows: SimilaritySignalRow[];
  evidenceConfidence: number | null;
  recruiterSummary: string | null;
  username: string;
  profileUrl: string;
  lastScannedAt: string | null;
  repositoriesAnalyzed: number | null;
}) {
  const fullRepos = repos.map(rowToFullRepoAnalysis);
  const okRepos = repos.filter((r) => r.scan_status === "ok");
  const failedRepos = repos.filter((r) => r.scan_status === "failed");
  const hasPartialCoverage = failedRepos.length > 0;

  const technologies = deriveTechnologyObservations(fullRepos);
  const practices = derivePracticeSignals(fullRepos);
  const { authenticitySignals, reviewSignals } = deriveAuthenticityAndReview(fullRepos);

  const totalCommits = okRepos.reduce((sum, r) => sum + r.candidate_commit_count, 0);
  const totalPrsOpened = okRepos.reduce((sum, r) => sum + r.candidate_pr_count, 0);
  const totalPrsMerged = okRepos.reduce((sum, r) => sum + r.candidate_pr_merged_count, 0);

  // Development timeline: real per-year technology + repo counts, nothing invented.
  const byYear = new Map<string, { repoCount: number; technologies: Set<string> }>();
  for (const r of okRepos) {
    const year = r.repo_updated_at ? new Date(r.repo_updated_at).getFullYear().toString() : null;
    if (!year) continue;
    const bucket = byYear.get(year) ?? { repoCount: 0, technologies: new Set<string>() };
    bucket.repoCount += 1;
    for (const t of r.tech_signals) bucket.technologies.add(t);
    byYear.set(year, bucket);
  }
  const timeline = [...byYear.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));

  const staleDays = lastScannedAt ? daysSince(lastScannedAt) : null;

  return (
    <div className="mt-6 flex flex-col gap-5">
      {/* Header + Recruiter Summary */}
      <div className="rounded-xl border border-app-border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-lp-body text-[15px] font-medium text-app-charcoal">@{username}</p>
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="font-lp-mono text-[11px] text-app-blue hover:underline">
              View GitHub Profile
            </a>
          </div>
          {evidenceConfidence != null && (
            <div className="text-right">
              <span className="font-lp-display text-[26px] font-semibold text-app-charcoal">{evidenceConfidence}</span>
              <p className="font-lp-mono text-[10px] uppercase tracking-wide text-app-muted">GitHub Evidence Confidence</p>
            </div>
          )}
        </div>
        {recruiterSummary && <p className="mt-3 font-lp-body text-[13px] leading-relaxed text-app-charcoal">{recruiterSummary}</p>}
      </div>

      {hasPartialCoverage && (
        <div className="flex items-center gap-2 rounded-lg border border-app-warning bg-app-warning-container px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 text-app-warning" />
          <p className="font-lp-body text-[12.5px] text-app-charcoal">
            {failedRepos.length} of {repos.length} repositories couldn&rsquo;t be fully analyzed in this scan. The rest of
            this page reflects the {okRepos.length} that were.
          </p>
        </div>
      )}

      {/* Engineering Activity */}
      <div className="rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Engineering Activity</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Repositories" value={okRepos.length} />
          <Stat label="Commits" value={totalCommits} />
          <Stat label="PRs opened" value={totalPrsOpened} />
          <Stat label="PRs merged" value={totalPrsMerged} />
        </div>
      </div>

      {/* Technology DNA */}
      {technologies.length > 0 && (
        <div className="rounded-xl border border-app-border bg-white p-5">
          <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Technology DNA</h2>
          <p className="mt-1 font-lp-body text-[12px] text-app-muted">Observed GitHub usage — not a claim of verified professional skill.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {technologies.map((t) => (
              <span key={t.technology} className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-lp-mono text-[11px] font-semibold ${STRENGTH_CLASS[t.strength]}`}>
                {t.technology}
                <span className="opacity-70">· {STRENGTH_LABEL[t.strength]}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      <div className="rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Projects</h2>
        <div className="mt-3 flex flex-col gap-4">
          {okRepos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} similarity={similarityRows.filter((s) => s.repository_id === repo.id)} />
          ))}
          {failedRepos.map((repo) => (
            <div key={repo.id} className="rounded-lg border border-dashed border-app-border p-3">
              <p className="font-lp-body text-[13px] text-app-muted">
                {repo.name} — could not be fully analyzed in this scan.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Engineering practices */}
      <div className="rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Engineering Practices</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {practices.map((p) => {
            const Icon = PRACTICE_ICON[p.state];
            return (
              <div key={p.practice} className="rounded-lg border border-app-border p-3">
                <div className="flex items-center gap-2">
                  <Icon size={16} className={p.state === "observed" ? "text-app-success" : "text-app-muted"} />
                  <p className="font-lp-body text-[13px] font-medium text-app-charcoal">{p.practice}</p>
                </div>
                {p.evidence.length > 0 && (
                  <ul className="mt-1.5 ml-6 flex flex-col gap-0.5">
                    {p.evidence.slice(0, 3).map((e, i) => (
                      <li key={i} className="font-lp-mono text-[10.5px] text-app-muted">
                        <a href={e.repoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {e.repoName}
                        </a>{" "}
                        — {e.detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Authenticity + Review signals */}
      <div className="rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Authenticity Signals</h2>
        {authenticitySignals.length === 0 ? (
          <p className="mt-2 font-lp-body text-[13px] text-app-muted">Insufficient coverage to raise a signal yet.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {authenticitySignals.map((s) => (
              <div key={s.signal} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-app-success" />
                <div>
                  <p className="font-lp-body text-[13px] font-medium text-app-charcoal">{s.signal}</p>
                  <p className="font-lp-body text-[12px] text-app-muted">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewSignals.length > 0 && (
        <div className="rounded-xl border border-app-border bg-white p-5">
          <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Review Signals</h2>
          <p className="mt-1 font-lp-body text-[12px] text-app-muted">
            Worth a closer look, not a finding of wrongdoing — a fork, limited history, or a short contribution
            window is not suspicious by itself.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {reviewSignals.map((s) => (
              <div key={s.signal} className="flex items-start gap-2">
                <Eye size={14} className="mt-0.5 shrink-0 text-app-attention" />
                <div>
                  <p className="font-lp-body text-[13px] font-medium text-app-charcoal">{s.signal}</p>
                  <p className="font-lp-body text-[12px] text-app-muted">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Originality review */}
      {similarityRows.length > 0 && (
        <div className="rounded-xl border border-app-border bg-white p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-app-charcoal" />
            <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Originality Review</h2>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {similarityRows.map((s) => {
              const repo = repos.find((r) => r.id === s.repository_id);
              return (
                <div key={s.id} className="rounded-lg border border-app-border p-3">
                  <p className="font-lp-body text-[13px] font-medium text-app-charcoal">
                    {SIMILARITY_LABEL[s.similarity_level] ?? s.similarity_level}
                  </p>
                  <p className="mt-1 font-lp-mono text-[11px] text-app-muted">
                    {repo?.name} ↔{" "}
                    <a href={s.matched_repo_url} target="_blank" rel="noopener noreferrer" className="text-app-blue hover:underline">
                      {s.matched_repo_full_name}
                    </a>
                    {s.affected_area && ` · ${s.affected_area}`}
                  </p>
                  {s.possible_explanations.length > 0 && (
                    <p className="mt-1 font-lp-body text-[11.5px] text-app-muted">
                      Possible explanations: {s.possible_explanations.join("; ")}.
                    </p>
                  )}
                  <a
                    href={s.matched_repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-lp-mono text-[11px] text-app-blue hover:underline"
                  >
                    Review Source
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Development timeline */}
      {timeline.length > 0 && (
        <div className="rounded-xl border border-app-border bg-white p-5">
          <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Development Timeline</h2>
          <div className="mt-3 flex flex-col gap-2">
            {timeline.map(([year, bucket]) => (
              <div key={year} className="flex items-center justify-between font-lp-body text-[13px]">
                <span className="font-lp-mono text-app-charcoal">{year}</span>
                <span className="text-app-muted">
                  {bucket.repoCount} repo{bucket.repoCount === 1 ? "" : "s"} · {[...bucket.technologies].slice(0, 4).join(", ") || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis coverage */}
      <div className="rounded-xl border-2 border-app-blue bg-app-blue-container/30 p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Analysis Coverage</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Repos analyzed" value={`${okRepos.length} / ${repositoriesAnalyzed ?? okRepos.length}`} />
          <Stat label="Commits" value={totalCommits} />
          <Stat label="PRs" value={totalPrsOpened} />
          <Stat label="Visibility" value="Public only" />
        </div>
        <p className="mt-3 font-lp-body text-[11.5px] text-app-muted">
          This reflects a defined, limited set of repositories — not necessarily the candidate&rsquo;s complete engineering
          history.
        </p>
      </div>

      {/* Freshness */}
      <div className="flex items-center justify-between rounded-lg border border-app-border bg-white px-4 py-3">
        <p className="flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted">
          <Clock size={12} />
          GitHub analysis updated {formatDate(lastScannedAt) ?? "—"}
          {staleDays !== null && staleDays > 14 && ` (${staleDays} days ago)`}
        </p>
        <Link
          href="/dashboard/vault"
          className="flex items-center gap-1 font-lp-mono text-[11px] font-semibold text-app-blue hover:underline"
        >
          <RefreshCw size={11} />
          Refresh analysis
        </Link>
      </div>

      <AboutThisAnalysis />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">{label}</p>
      <p className="mt-1 font-lp-display text-[18px] font-semibold text-app-charcoal">{value}</p>
    </div>
  );
}

function RepoCard({ repo, similarity }: { repo: RepositoryRow; similarity: SimilaritySignalRow[] }) {
  const owner = repo.full_name.split("/")[0];
  const languages = (repo.languages ?? []) as { name: string; percentage: number }[];
  const topContributors = (repo.top_contributors ?? []) as { login: string; contributions: number }[];

  return (
    <div className="rounded-lg border border-app-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="font-lp-body text-[14px] font-semibold text-app-charcoal hover:underline">
            {repo.name}
          </a>
          <span className="ml-1.5 font-lp-mono text-[11px] text-app-muted">by {owner}</span>
          {repo.description && <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">{repo.description}</p>}
        </div>
        <div className="flex items-center gap-3 font-lp-mono text-[11px] text-app-muted">
          <span className="flex items-center gap-1">
            <Star size={11} />
            {repo.stars}
          </span>
          <span className="flex items-center gap-1">
            <GitFork size={11} />
            {repo.forks_count}
          </span>
          {repo.contributors_count != null && (
            <span className="flex items-center gap-1">
              <Users size={11} />
              {repo.contributors_count}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {repo.is_fork && repo.fork_source_full_name && (
          <span className="rounded-full bg-app-attention-container px-2 py-0.5 font-lp-mono text-[10px] text-app-attention">
            Forked from {repo.fork_source_full_name}
          </span>
        )}
        {repo.is_archived && <span className="rounded-full bg-app-background px-2 py-0.5 font-lp-mono text-[10px] text-app-muted">Archived</span>}
        {repo.license && <span className="rounded-full border border-app-border px-2 py-0.5 font-lp-mono text-[10px] text-app-muted">{repo.license}</span>}
        {repo.tech_signals.map((t) => (
          <span key={t} className="rounded-full border border-app-border px-2 py-0.5 font-lp-mono text-[10px] text-app-charcoal">
            {t}
          </span>
        ))}
      </div>

      {/* Contribution */}
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-app-border pt-3 sm:grid-cols-4">
        <Stat label="Commits" value={repo.candidate_commit_count} />
        <Stat label="PRs" value={`${repo.candidate_pr_count} (${repo.candidate_pr_merged_count} merged)`} />
        <Stat label="Active" value={formatDate(repo.repo_updated_at) ?? "—"} />
        <Stat label="Created" value={formatDate(repo.repo_created_at) ?? "—"} />
      </div>

      {languages.length > 0 && (
        <div className="mt-3 border-t border-app-border pt-3">
          <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">Languages</p>
          <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-app-background">
            {languages.map((l) => (
              <span key={l.name} style={{ width: `${l.percentage}%` }} className="h-full bg-app-blue first:rounded-l-full last:rounded-r-full odd:opacity-100 even:opacity-70" />
            ))}
          </div>
          <p className="mt-1.5 font-lp-body text-[11.5px] text-app-muted">
            {languages.map((l) => `${l.name} ${l.percentage}%`).join(" · ")}
          </p>
        </div>
      )}

      {topContributors.length > 0 && (
        <div className="mt-3 border-t border-app-border pt-3">
          <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">Contributors</p>
          <p className="mt-1.5 font-lp-body text-[11.5px] text-app-muted">
            {topContributors.map((c) => `${c.login} (${c.contributions})`).join(" · ")}
          </p>
        </div>
      )}

      {similarity.length > 0 && (
        <p className="mt-2 flex items-center gap-1 font-lp-mono text-[10.5px] text-app-attention">
          <Eye size={11} />
          Originality review available below
        </p>
      )}

      {(repo.has_database_signal || repo.has_auth_signal || repo.has_tests || repo.has_ci) && (
        <p className="mt-2 font-lp-mono text-[10.5px] text-app-muted">
          Project scale: {[repo.has_dependencies && "dependencies", repo.has_database_signal && "database", repo.has_auth_signal && "auth", repo.has_tests && "tests", repo.has_ci && "CI"].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

function AboutThisAnalysis() {
  return (
    <div className="rounded-xl border border-dashed border-app-border bg-white p-5">
      <p className="font-lp-mono text-[10.5px] font-semibold uppercase tracking-wide text-app-muted">About This Analysis</p>
      <p className="mt-2 font-lp-body text-[12.5px] leading-relaxed text-app-charcoal">
        Code DNA summarizes publicly available GitHub evidence to help you understand a candidate&rsquo;s engineering
        work, contribution history, repository provenance, and originality signals.
      </p>
      <p className="mt-3 font-lp-mono text-[10.5px] font-semibold uppercase tracking-wide text-app-muted">Analysis coverage</p>
      <ul className="mt-1.5 list-inside list-disc font-lp-body text-[12px] text-app-muted">
        <li>Public GitHub repositories available to Capabilio</li>
        <li>Repository activity and contribution history</li>
        <li>Commit and pull-request signals</li>
        <li>Repository structure and technology usage</li>
        <li>Provenance and public-source similarity signals</li>
      </ul>
      <p className="mt-3 font-lp-mono text-[10.5px] font-semibold uppercase tracking-wide text-app-muted">Important limitations</p>
      <ul className="mt-1.5 list-inside list-disc font-lp-body text-[12px] text-app-muted">
        <li>Private repositories are not included unless explicitly authorized and supported.</li>
        <li>Analysis covers a defined set of repositories and available GitHub history, not necessarily the candidate&rsquo;s complete engineering history.</li>
        <li>Commit authorship and contribution signals are based on GitHub metadata and may not perfectly establish authorship.</li>
        <li>Similarity signals indicate potential reuse or overlap; they do not by themselves establish plagiarism or intent.</li>
        <li>Code DNA is an evidence summary, not a formal code-quality, security, or plagiarism certification.</li>
      </ul>
    </div>
  );
}
