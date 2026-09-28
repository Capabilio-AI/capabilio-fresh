import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Award, BadgeCheck, CheckCircle2, GitBranch, MinusCircle, Sparkles, XCircle } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { buildEvidenceProfile, type EngineeringPracticeState } from "@/lib/code-dna/evidence-profile";
import { categorySlug, deriveCapabilityProfile, CAPABILITY_CATEGORIES, type ArenaProgrammingEvidence } from "@/lib/code-dna/capability-derivation";
import type { GithubScanResult } from "@/lib/code-dna/github-scan";
import { CodeDnaTrajectoryChart, type TrajectoryPoint } from "@/components/vault/CodeDnaTrajectoryChart";
import { SECTION_LABEL } from "@/lib/assessment/sections";

export const metadata: Metadata = { title: "Code DNA — Capabilio AI" };

const PRACTICE_ICON: Record<EngineeringPracticeState, typeof CheckCircle2> = {
  observed: CheckCircle2,
  not_observed: MinusCircle,
  not_available: XCircle,
};
const PRACTICE_LABEL: Record<EngineeringPracticeState, string> = {
  observed: "Observed",
  not_observed: "Not observed",
  not_available: "Not enough data",
};
const PRACTICE_CLASS: Record<EngineeringPracticeState, string> = {
  observed: "text-app-success",
  not_observed: "text-app-attention",
  not_available: "text-app-muted",
};
const CONFIDENCE_CLASS: Record<string, string> = {
  low: "bg-app-attention-container text-app-attention",
  medium: "bg-app-warning-container text-app-warning",
  high: "bg-app-success-container text-app-success",
};

export default async function CodeDnaDetailPage() {
  const { supabase, user } = await requireAuthedUser();

  const [{ data: connection }, { data: allArenaAttempts }] = await Promise.all([
    supabase
      .from("github_connections")
      .select("username, profile_url, code_dna_score, confidence_level, recruiter_summary, analysis, last_scanned_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("arena_challenge_attempts")
      .select("section, correct_count, answered_count, completed_at, rating_after")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: true }),
  ]);

  const githubScan = connection?.analysis ? (connection.analysis as unknown as GithubScanResult) : null;
  const programmingAttempts: ArenaProgrammingEvidence[] = (allArenaAttempts ?? [])
    .filter((a) => a.section === "programming_fundamentals")
    .map((a) => ({ correctCount: a.correct_count, answeredCount: a.answered_count, completedAt: a.completed_at as string }));

  const capabilityProfile = deriveCapabilityProfile(githubScan, connection?.last_scanned_at ?? null, programmingAttempts);
  const derivedCategories = new Set(capabilityProfile.map((c) => c.category));
  const notEnoughEvidence = CAPABILITY_CATEGORIES.filter((c) => !derivedCategories.has(c));

  const trajectoryPoints: TrajectoryPoint[] = (allArenaAttempts ?? [])
    .filter((a) => a.rating_after !== null)
    .map((a) => ({
      date: new Date(a.completed_at as string).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      rating: a.rating_after as number,
    }));

  const recentProofRepos = githubScan?.repos.slice(0, 3) ?? [];
  const recentArenaAttempts = [...(allArenaAttempts ?? [])].reverse().slice(0, 3);

  const hasAnyEvidence = capabilityProfile.length > 0 || Boolean(githubScan);

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/vault" className="flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted hover:text-app-charcoal">
        <ArrowLeft size={12} />
        Back to Vault
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <GitBranch size={20} className="text-app-charcoal" />
        <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Code DNA</h1>
      </div>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        What your verified engineering work demonstrates you can build, test, and ship — derived from real evidence,
        never self-reported.
      </p>

      {!hasAnyEvidence ? (
        <div className="mt-6 rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
          <Sparkles size={20} className="mx-auto text-app-blue" />
          <p className="mt-2 font-lp-body text-[13.5px] font-medium text-app-charcoal">Your Code DNA is starting</p>
          <p className="mt-1 font-lp-body text-[13px] text-app-muted">
            Complete an Arena challenge or connect your GitHub from the Vault tab to see your evidence here.
          </p>
          <Link
            href="/arena"
            className="mt-4 inline-block rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white"
          >
            Enter Arena
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          {/* Capability Profile */}
          <div className="rounded-xl border border-app-border bg-white p-5">
            <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Capability Profile</h2>
            {capabilityProfile.length === 0 ? (
              <p className="mt-2 font-lp-body text-[13px] text-app-muted">Code DNA is forming — not enough evidence yet.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {capabilityProfile.map((c) => (
                  <Link
                    key={c.category}
                    href={`/dashboard/vault/code-dna/${categorySlug(c.category)}`}
                    className="flex items-center justify-between rounded-lg border border-app-border p-3 hover:bg-app-background"
                  >
                    <div>
                      <p className="font-lp-body text-[13px] font-medium text-app-charcoal">{c.category}</p>
                      <p className="mt-0.5 font-lp-mono text-[10.5px] text-app-muted">
                        {c.evidenceCount} evidence point{c.evidenceCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 font-lp-mono text-[10px] font-semibold ${CONFIDENCE_CLASS[c.confidence]}`}>
                        {c.confidence}
                      </span>
                      <span className="font-lp-display text-[18px] font-semibold text-app-charcoal">{c.score}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {notEnoughEvidence.length > 0 && (
              <p className="mt-3 font-lp-mono text-[10.5px] text-app-muted">
                Not enough evidence yet: {notEnoughEvidence.join(", ")}
              </p>
            )}
          </div>

          {/* Engineering Signature — reuses the existing scan-time narrative, never generated on page load */}
          {connection?.recruiter_summary && (
            <div className="rounded-xl border border-app-border bg-white p-5">
              <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Engineering Signature</h2>
              <p className="mt-2 font-lp-body text-[13px] leading-relaxed text-app-muted">{connection.recruiter_summary}</p>
            </div>
          )}

          {/* Recent Proof */}
          {(recentProofRepos.length > 0 || recentArenaAttempts.length > 0) && (
            <div className="rounded-xl border border-app-border bg-white p-5">
              <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Recent Proof</h2>
              <div className="mt-3 flex flex-col gap-2.5">
                {recentArenaAttempts.map((a, i) => (
                  <div key={`arena-${i}`} className="flex items-center gap-2.5">
                    <Award size={14} className="shrink-0 text-app-orange" />
                    <p className="font-lp-body text-[12.5px] text-app-charcoal">
                      Arena · {SECTION_LABEL[a.section as keyof typeof SECTION_LABEL] ?? a.section} — {a.correct_count}/{a.answered_count} correct
                    </p>
                  </div>
                ))}
                {recentProofRepos.map((r) => (
                  <a
                    key={r.name}
                    href={r.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 hover:underline"
                  >
                    <BadgeCheck size={14} className="shrink-0 text-app-blue" />
                    <p className="font-lp-body text-[12.5px] text-app-charcoal">{r.name}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Trajectory — only from real timestamped Arena history */}
          <div className="rounded-xl border border-app-border bg-white p-5">
            <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Trajectory</h2>
            {trajectoryPoints.length >= 2 ? (
              <div className="mt-3">
                <CodeDnaTrajectoryChart points={trajectoryPoints} />
              </div>
            ) : (
              <div className="mt-3 text-center">
                <p className="font-lp-body text-[13px] text-app-muted">
                  Building your DNA — complete more Arena challenges to see your trajectory.
                </p>
                <Link href="/arena" className="mt-2 inline-block font-lp-mono text-[11px] text-app-blue hover:underline">
                  Enter Arena
                </Link>
              </div>
            )}
          </div>

          {githubScan && (
            <CodeDnaGithubEvidence
              scan={githubScan}
              score={connection?.code_dna_score ?? null}
              confidence={connection?.confidence_level ?? null}
              username={connection?.username ?? ""}
              profileUrl={connection?.profile_url ?? ""}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CodeDnaGithubEvidence({
  scan,
  score,
  confidence,
  username,
  profileUrl,
}: {
  scan: GithubScanResult;
  score: number | null;
  confidence: string | null;
  username: string;
  profileUrl: string;
}) {
  const profile = buildEvidenceProfile(scan);

  return (
    <>
      <div className="rounded-xl border border-app-border bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">
              @{username} · <span className="font-lp-mono text-[11px] text-app-muted">{confidence} confidence</span>
            </p>
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="font-lp-mono text-[11px] text-app-blue hover:underline">
              View GitHub profile
            </a>
          </div>
          {score != null && <span className="font-lp-display text-[28px] font-semibold text-app-charcoal">{score}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Technical footprint</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(["frontend", "backend", "devops"] as const).map((bucket) => (
            <div key={bucket}>
              <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">{bucket}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {profile.technicalFootprint[bucket].length === 0 ? (
                  <span className="font-lp-body text-[12px] text-app-muted">—</span>
                ) : (
                  profile.technicalFootprint[bucket].map((t) => (
                    <span key={t} className="rounded-full border border-app-border px-2 py-0.5 font-lp-mono text-[10.5px] text-app-charcoal">
                      {t}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Engineering practice</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["testing", "ci", "documentation"] as const).map((key) => {
            const state = profile.engineeringPractice[key];
            const Icon = PRACTICE_ICON[state];
            return (
              <div key={key} className="flex items-center gap-2">
                <Icon size={16} className={PRACTICE_CLASS[state]} />
                <div>
                  <p className="font-lp-body text-[12.5px] capitalize text-app-charcoal">{key}</p>
                  <p className="font-lp-mono text-[10.5px] text-app-muted">{PRACTICE_LABEL[state]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Authorship &amp; collaboration</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">Original repos</p>
            <p className="mt-1 font-lp-body text-[15px] font-semibold text-app-charcoal">{profile.authorshipEvidence.originalRepoCount}</p>
          </div>
          <div>
            <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">Forked repos</p>
            <p className="mt-1 font-lp-body text-[15px] font-semibold text-app-charcoal">{profile.authorshipEvidence.forkedRepoCount}</p>
          </div>
          <div>
            <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">PRs opened</p>
            <p className="mt-1 font-lp-body text-[15px] font-semibold text-app-charcoal">{profile.collaborationEvidence.pullRequestsOpened}</p>
          </div>
          <div>
            <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">PRs merged</p>
            <p className="mt-1 font-lp-body text-[15px] font-semibold text-app-charcoal">{profile.collaborationEvidence.pullRequestsMerged}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Project evidence</h2>
        <div className="mt-3 flex flex-col gap-3">
          {profile.projectEvidence.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-1.5 rounded-lg border border-app-border p-3 hover:bg-app-background sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-lp-body text-[13px] font-medium text-app-charcoal">{p.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {!p.isOriginalWork && (
                    <span className="rounded-full bg-app-attention-container px-2 py-0.5 font-lp-mono text-[10px] text-app-attention">Fork</span>
                  )}
                  {p.hasReadme && (
                    <span className="rounded-full bg-app-success-container px-2 py-0.5 font-lp-mono text-[10px] text-app-success">README</span>
                  )}
                  {p.hasTests && (
                    <span className="rounded-full bg-app-blue-container px-2 py-0.5 font-lp-mono text-[10px] text-app-blue">Tests</span>
                  )}
                  {p.techSignals.map((t) => (
                    <span key={t} className="rounded-full border border-app-border px-2 py-0.5 font-lp-mono text-[10px] text-app-muted">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-app-border bg-white px-4 py-3">
        <p className="font-lp-mono text-[10.5px] font-semibold uppercase tracking-wide text-app-muted">Limitations</p>
        <ul className="mt-1.5 list-inside list-disc font-lp-body text-[12px] text-app-muted">
          {profile.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
