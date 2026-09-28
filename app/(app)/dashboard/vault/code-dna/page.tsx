import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, GitBranch, MinusCircle, XCircle } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { buildEvidenceProfile, type EngineeringPracticeState } from "@/lib/code-dna/evidence-profile";
import type { GithubScanResult } from "@/lib/code-dna/github-scan";

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

export default async function CodeDnaDetailPage() {
  const { supabase, user } = await requireAuthedUser();

  const { data: connection } = await supabase
    .from("github_connections")
    .select("username, profile_url, code_dna_score, confidence_level, recruiter_summary, analysis, last_scanned_at")
    .eq("user_id", user.id)
    .maybeSingle();

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
        Real engineering evidence, built from your public GitHub activity — not a self-reported claim.
      </p>

      {!connection || !connection.analysis ? (
        <div className="mt-6 rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
          <p className="font-lp-body text-[13.5px] text-app-muted">
            Connect and scan your GitHub from the Vault tab to see your evidence breakdown here.
          </p>
        </div>
      ) : (
        <CodeDnaEvidence
          scan={connection.analysis as unknown as GithubScanResult}
          score={connection.code_dna_score}
          confidence={connection.confidence_level}
          recruiterSummary={connection.recruiter_summary}
          username={connection.username}
          profileUrl={connection.profile_url}
        />
      )}
    </div>
  );
}

function CodeDnaEvidence({
  scan,
  score,
  confidence,
  recruiterSummary,
  username,
  profileUrl,
}: {
  scan: GithubScanResult;
  score: number | null;
  confidence: string | null;
  recruiterSummary: string | null;
  username: string;
  profileUrl: string;
}) {
  const profile = buildEvidenceProfile(scan);

  return (
    <div className="mt-6 flex flex-col gap-5">
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
          <span className="font-lp-display text-[28px] font-semibold text-app-charcoal">{score}</span>
        </div>
        {recruiterSummary && <p className="mt-3 font-lp-body text-[13px] leading-relaxed text-app-muted">{recruiterSummary}</p>}
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
    </div>
  );
}
