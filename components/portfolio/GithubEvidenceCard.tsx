import Link from "next/link";
import { CheckCircle2, ExternalLink, Eye, GitBranch, ShieldCheck, Star } from "lucide-react";
import type { GithubEvidence } from "@/lib/portfolio/github-evidence";
import { ContributionHeatmap } from "@/components/vault/ContributionHeatmap";

const HEATMAP_WEEKS = 26;
const formatMonth = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-lp-body text-[11px] uppercase tracking-wide text-[var(--m-muted)]">{label}</p>
      <p className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">{value}</p>
    </div>
  );
}

function originalityLine(o: NonNullable<GithubEvidence["originality"]>): string {
  if (o.status !== "checked") return "Code was not compared against public repositories in this scan.";
  const base = `${o.checkedRepos} repositories compared with public code by exact file content`;
  return o.overlaps === 0 ? `${base}: no overlap with older repositories.` : `${base}: ${o.overlaps} overlap${o.overlaps === 1 ? "" : "s"} listed for review.`;
}

/** What a recruiter would open GitHub to look for, from the stored scan. Facts only; wording stays neutral. */
export function GithubEvidenceCard({ github, isOwner }: { github: GithubEvidence; isOwner: boolean }) {
  const { score, breakdown, account, activity, originality, topRepos, languages } = github;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <a href={github.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-lp-body text-[15px] font-bold text-[var(--m-ink)] hover:underline">
          <GitBranch size={16} aria-hidden />{github.username}<ExternalLink size={12} className="text-[var(--m-muted)]" aria-hidden />
        </a>
        <p className="mt-1 flex items-center gap-1.5 font-lp-body text-[13px] text-[var(--m-muted)]">
          {github.verified && <ShieldCheck size={14} aria-hidden className="text-[var(--m-accent-ink)]" />}
          {[github.verified ? "Ownership verified" : "Ownership not verified", account ? `On GitHub since ${formatMonth(account.createdAt)}` : null].filter(Boolean).join(" · ")}
        </p>
      </div>

      {score != null && (
        <div>
          <p className="font-lp-display text-[34px] font-bold leading-none text-[var(--m-ink)]">{score}<span className="text-[15px] font-bold text-[var(--m-muted)]"> / 100</span></p>
          <p className="mt-1 font-lp-body text-[12px] text-[var(--m-muted)]">Code DNA score, counted from public GitHub activity</p>
          {breakdown && (
            <ul className="mt-3 flex flex-col gap-2">
              {breakdown.parts.map((p) => (
                <li key={p.key}>
                  <div className="flex justify-between font-lp-body text-[12.5px] text-[var(--m-ink)]"><span>{p.label}</span><span className="font-bold">{p.score}</span></div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--m-ground)]"><div className="h-full rounded-full bg-[var(--m-accent-ink)]" style={{ width: `${p.score}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activity && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Fact label="Contributions, 1 yr" value={activity.totalContributions.toLocaleString("en-IN")} />
            <Fact label="Active days" value={activity.activeDays} />
            <Fact label="Merged in others' repos" value={activity.externalPullRequests.merged} />
            <Fact label="Longest streak" value={`${activity.longestStreak} days`} />
          </div>
          <div className="text-[var(--m-accent-ink)]"><ContributionHeatmap calendar={activity.calendar} calendarStart={activity.calendarStart} recentWeeks={HEATMAP_WEEKS} /></div>
        </div>
      )}

      {languages.length > 0 && <p className="font-lp-body text-[13px] text-[var(--m-ink)]">{languages.map((l) => `${l.name} ${l.percentage}%`).join(" · ")}</p>}

      {topRepos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {topRepos.map((r) => (
            <li key={r.name} className="font-lp-body text-[13px]">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--m-ink)] hover:underline">{r.name}</a>
              <span className="ml-2 inline-flex items-center gap-1 text-[var(--m-muted)]"><Star size={11} aria-hidden />{r.stars}</span>
              <span className="text-[var(--m-muted)]">{[r.language, `${r.commits} commits`].filter(Boolean).map((t) => ` · ${t}`).join("")}</span>
              {r.explainedScore != null && <span className="ml-2 rounded-full bg-[var(--m-ground)] px-2 py-0.5 text-[11px] font-bold text-[var(--m-ink)]">Explained {r.explainedScore}/100</span>}
              {r.description && <p className="text-[12.5px] text-[var(--m-muted)]">{r.description}</p>}
            </li>
          ))}
        </ul>
      )}

      {originality && <p className="font-lp-body text-[12.5px] text-[var(--m-muted)]">{originalityLine(originality)}</p>}

      {(github.positiveNotes.length > 0 || github.reviewNotes.length > 0) && (
        <ul className="flex flex-col gap-1.5 font-lp-body text-[12.5px] text-[var(--m-ink)]">
          {github.positiveNotes.map((n) => <li key={n} className="flex items-start gap-1.5"><CheckCircle2 size={13} aria-hidden className="mt-0.5 shrink-0 text-[var(--m-accent-ink)]" />{n}</li>)}
          {github.reviewNotes.map((n) => <li key={n} className="flex items-start gap-1.5 text-[var(--m-muted)]"><Eye size={13} aria-hidden className="mt-0.5 shrink-0" />{n}</li>)}
        </ul>
      )}
      {github.reviewNotes.length > 0 && <p className="-mt-2 font-lp-body text-[11.5px] text-[var(--m-muted)]">Notes with an eye icon are worth a look, not a finding of wrongdoing.</p>}

      <p className="font-lp-body text-[11.5px] text-[var(--m-muted)]">
        {github.repositoriesAnalyzed ? `${github.repositoriesAnalyzed} public repositories analysed` : "Public repositories only"}
        {github.lastScannedAt ? `, scanned ${formatMonth(github.lastScannedAt)}` : ""}.
      </p>
      {isOwner && <Link href="/dashboard/vault/code-dna" className="inline-block font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline print:hidden">Open Code DNA</Link>}
    </div>
  );
}
