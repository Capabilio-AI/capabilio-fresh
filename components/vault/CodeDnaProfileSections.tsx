import { CheckCircle2, Eye, ShieldCheck, ShieldAlert } from "lucide-react";
import type { AccountFacts, ActivitySummary } from "@/lib/code-dna/github-profile";
import type { ForensicSignal } from "@/lib/code-dna/commit-forensics";
import type { OriginalityReport } from "@/lib/code-dna/originality";
import type { ScoreBreakdown } from "@/lib/code-dna/score-breakdown";
import { ContributionHeatmap } from "./ContributionHeatmap";

const formatYear = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
const scoreTone = (score: number) => (score >= 70 ? "bg-app-success" : score >= 40 ? "bg-app-warning" : "bg-app-attention");

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">{label}</p>
      <p className="mt-1 font-lp-display text-[18px] font-semibold text-app-charcoal">{value}</p>
    </div>
  );
}

export function ProfileActivityCard({ account, activity }: { account: AccountFacts | null; activity: ActivitySummary | null }) {
  if (!account && !activity) return null;
  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Profile &amp; Activity</h2>
      {account && (
        <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
          On GitHub since {formatYear(account.createdAt)} · {account.followers.toLocaleString("en-IN")} followers · {account.publicRepos} public repositories
          {account.location ? ` · ${account.location}` : ""}
        </p>
      )}
      {activity && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Contributions (1 yr)" value={activity.totalContributions.toLocaleString("en-IN")} />
            <Stat label="Active days" value={activity.activeDays} />
            <Stat label="Longest streak" value={`${activity.longestStreak} days`} />
            <Stat label="Active weeks" value={`${activity.activeWeeks} / 52`} />
            <Stat label="Pull requests" value={activity.pullRequests} />
            <Stat label="Reviews given" value={activity.reviews} />
            <Stat label="Issues" value={activity.issues} />
            <Stat label="PRs merged elsewhere" value={`${activity.externalPullRequests.merged} / ${activity.externalPullRequests.opened}`} />
          </div>
          <div className="mt-4 text-app-success">
            <ContributionHeatmap calendar={activity.calendar} calendarStart={activity.calendarStart} />
          </div>
          {activity.privateContributions > 0 && (
            <p className="mt-2 font-lp-body text-[11.5px] text-app-muted">
              Plus {activity.privateContributions.toLocaleString("en-IN")} contributions in private repositories, counted by GitHub but not analysed here.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function ScoreBreakdownCard({ breakdown }: { breakdown: ScoreBreakdown | null }) {
  if (!breakdown) return null;
  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">How the score is built</h2>
        <span className="font-lp-display text-[22px] font-semibold text-app-charcoal">{breakdown.overall}<span className="text-[13px] text-app-muted"> / 100</span></span>
      </div>
      <p className="mt-1 font-lp-body text-[12px] text-app-muted">
        Every part is counted from public GitHub facts. No AI decides any number here.
        {breakdown.basis === "repos-only" && " This scan had no contribution calendar, so activity uses repository data only."}
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {breakdown.parts.map((p) => (
          <li key={p.key}>
            <div className="flex items-center justify-between font-lp-body text-[13px] text-app-charcoal">
              <span className="font-medium">{p.label} <span className="font-lp-mono text-[10.5px] text-app-muted">· {p.weight}% of score</span></span>
              <span className="font-lp-mono">{p.score}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-app-background">
              <div className={`h-full rounded-full ${scoreTone(p.score)}`} style={{ width: `${p.score}%` }} />
            </div>
            <p className="mt-1 font-lp-body text-[11.5px] text-app-muted">{p.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CommitSignalList({ signals }: { signals: ForensicSignal[] }) {
  if (signals.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-app-border pt-3">
      <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">Commit history</p>
      {signals.map((s) => (
        <p key={s.signal} className="flex items-start gap-1.5 font-lp-body text-[12px] text-app-muted">
          {s.tone === "positive" ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-app-success" /> : <Eye size={13} className="mt-0.5 shrink-0 text-app-attention" />}
          <span><span className="font-medium text-app-charcoal">{s.signal}.</span> {s.detail}</span>
        </p>
      ))}
    </div>
  );
}

/** What the content comparison covered, so "no matches" is never mistaken for "not checked". */
export function OriginalityCoverage({ report, flaggedCount }: { report: OriginalityReport | null; flaggedCount: number }) {
  if (!report) return null;
  if (report.status === "unavailable") {
    return (
      <div className="rounded-xl border border-dashed border-app-border bg-white p-5">
        <div className="flex items-center gap-2"><ShieldAlert size={16} className="text-app-muted" /><h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Originality check</h2></div>
        <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">Code comparison against public repositories wasn&rsquo;t run for this scan, so nothing here says the work is original or copied.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-app-success" /><h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Originality check</h2></div>
      <p className="mt-2 font-lp-body text-[12.5px] text-app-charcoal">
        Compared {report.checkedRepos} of {report.eligibleRepos} original repositories against public code by file content, exact and structural.{" "}
        {flaggedCount === 0 ? "No overlap with older public repositories was found." : `${flaggedCount} overlap${flaggedCount === 1 ? "" : "s"} listed below for review.`}
      </p>
      {report.copiedByOthers.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 font-lp-body text-[12px] text-app-muted">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-app-success" />
          Other public repositories contain {report.copiedByOthers.length === 1 ? "files" : "copies of files"} from {[...new Set(report.copiedByOthers.map((c) => c.repoName))].join(", ")} that were created later, which points to this being the original.
        </p>
      )}
      <p className="mt-2 font-lp-body text-[11.5px] text-app-muted">Comparison can miss code that was rewritten with a different structure. It shows evidence for a human to review, not a verdict.</p>
    </div>
  );
}
