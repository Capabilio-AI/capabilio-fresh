import Link from "next/link";
import { AlertTriangle, ArrowRight, Award, FolderKanban, Sparkles } from "lucide-react";
import type { CareerMatch } from "@/lib/career/skill-gap";
import type { NextAction } from "@/lib/dashboard/next-action";
import type { VaultItem } from "@/lib/vault/data";

export function SkillGapsPreviewCard({ match }: { match: CareerMatch | null }) {
  const gaps = match ? [...match.skillGaps].filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3) : [];

  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-warning">
          <AlertTriangle size={14} />
          Priority skill gaps
        </div>
        <Link href="/dashboard/skill-gap" className="font-lp-mono text-[11px] text-app-blue hover:underline">
          View all
        </Link>
      </div>
      {gaps.length === 0 ? (
        <p className="mt-4 font-lp-body text-[13px] text-app-muted">
          No priority gaps right now — you&apos;re on track for your top career match.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {gaps.map((g) => (
            <div key={g.skill}>
              <div className="flex items-center justify-between font-lp-body text-[13px]">
                <span className="text-app-charcoal">{g.skill}</span>
                <span className="font-lp-mono text-[11px] text-app-muted">
                  {g.current ?? 0}/{g.required}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-app-background">
                <div
                  className="h-full rounded-full bg-app-warning"
                  style={{ width: `${Math.min(100, ((g.current ?? 0) / g.required) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CurrentProjectCard() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-app-border bg-white p-5">
      <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-blue">
        <FolderKanban size={14} />
        Current project
      </div>
      <div className="mt-4 flex flex-1 flex-col items-start justify-center gap-2">
        <p className="font-lp-body text-[13px] text-app-muted">
          You haven&apos;t started a project yet. Projects turn skills into verifiable evidence for your Portfolio.
        </p>
        <Link
          href="/arena/projects"
          className="mt-1 flex items-center gap-1.5 font-lp-body text-[12.5px] font-semibold text-app-charcoal hover:underline"
        >
          Start a project
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}

export function MentorInsightCard({ action }: { action: NextAction | null }) {
  const insight = action
    ? `Your biggest lever right now is ${action.skill} — closing that gap moves your readiness for ${action.relatedCareer} more than anything else.`
    : "Once your assessment is in, I'll surface the single most useful thing to work on next.";

  return (
    <div className="flex h-full flex-col rounded-xl border border-app-border bg-app-orange-container p-5">
      <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-orange">
        <Sparkles size={14} />
        AI Mentor
      </div>
      <p className="mt-3 flex-1 font-lp-body text-[13px] leading-relaxed text-app-charcoal">{insight}</p>
      <Link
        href="/mentor"
        className="mt-3 flex items-center gap-1.5 font-lp-body text-[12.5px] font-semibold text-app-charcoal hover:underline"
      >
        Ask AI Mentor
        <ArrowRight size={13} />
      </Link>
    </div>
  );
}

export function ProofPortfolioPreview({ items }: { items: VaultItem[] }) {
  const preview = items.slice(0, 4);
  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-success">
          <Award size={14} />
          Proof &amp; portfolio
        </div>
        <Link href="/dashboard/portfolio" className="font-lp-mono text-[11px] text-app-blue hover:underline">
          View portfolio
        </Link>
      </div>
      {preview.length === 0 ? (
        <p className="mt-4 font-lp-body text-[13px] text-app-muted">
          Nothing verified yet. Add certificates, projects, or links to your Vault to start building proof.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {preview.map((item) => (
            <li key={item.id} className="flex items-center justify-between font-lp-body text-[13px]">
              <span className="truncate text-app-charcoal">{item.title}</span>
              <span className="shrink-0 font-lp-mono text-[10.5px] uppercase text-app-muted">{item.item_type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
