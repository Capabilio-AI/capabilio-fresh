import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CareerMatch } from "@/lib/career/skill-gap";
import type { NextAction } from "@/lib/dashboard/next-action";
import type { VaultItem } from "@/lib/vault/data";
import { AskMentorButton } from "@/components/mentor/AskMentorButton";

const CARD = "flex h-full flex-col rounded-xl border border-[var(--m-rule)] bg-white p-5";
const TITLE = "font-lp-display text-[17px] font-bold text-[var(--m-ink)]";
const LINK = "text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline";

export function SkillGapsPreviewCard({ match }: { match: CareerMatch | null }) {
  const gaps = match ? [...match.skillGaps].filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3) : [];
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={TITLE}>Priority skill gaps</h3>
        <Link href="/dashboard/skills?view=gaps" className={LINK}>View all</Link>
      </div>
      {gaps.length === 0 ? (
        <p className="mt-3 font-lp-body text-[13.5px] text-app-muted">No priority gaps right now. You&apos;re on track for your top career match.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {gaps.map((g) => (
            <li key={g.skill}>
              <div className="flex items-baseline justify-between gap-2 font-lp-body text-[13.5px]">
                <span className="font-bold text-[var(--m-ink)]">{g.skill}</span>
                <span className="text-[12.5px] text-app-muted">{g.current === null ? "Not assessed" : `${g.current}%`} · target {g.required}%</span>
              </div>
              <div className="relative mt-1.5 h-2 rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${g.skill}: ${g.current === null ? "not assessed" : `${g.current} percent`}, target ${g.required} percent`}>
                <div className="h-full rounded-full bg-[#b45309]" style={{ width: `${Math.min(100, ((g.current ?? 0) / Math.max(1, g.required)) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CurrentProjectCard() {
  return (
    <div className={CARD}>
      <h3 className={TITLE}>Current project</h3>
      <p className="mt-3 flex-1 font-lp-body text-[13.5px] text-app-muted">You haven&apos;t started a project yet. Projects turn skills into verifiable evidence for your Portfolio.</p>
      <Link href="/arena/projects" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--m-ink)] hover:underline">Start a project <ArrowRight size={14} aria-hidden /></Link>
    </div>
  );
}

export function MentorInsightCard({ action }: { action: NextAction | null }) {
  const insight = action
    ? `Your biggest lever right now is ${action.skill}. Closing that gap moves your readiness for ${action.relatedCareer} more than anything else.`
    : "Once your assessment is in, I'll surface the single most useful thing to work on next.";
  return (
    <div className="flex h-full flex-col rounded-xl bg-[var(--m-ink)] p-5 text-white">
      <h3 className="font-lp-display text-[17px] font-bold">AI Mentor</h3>
      <p className="mt-3 flex-1 font-lp-body text-[13.5px] leading-relaxed text-white/85">{insight}</p>
      <div className="mt-4"><AskMentorButton /></div>
    </div>
  );
}

export function ProofPortfolioPreview({ items }: { items: VaultItem[] }) {
  const preview = items.slice(0, 4);
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={TITLE}>Proof &amp; portfolio</h3>
        <Link href="/dashboard/portfolio" className={LINK}>View portfolio</Link>
      </div>
      {preview.length === 0 ? (
        <p className="mt-3 font-lp-body text-[13.5px] text-app-muted">Nothing verified yet. Add certificates, projects, or links to your Vault to start building proof.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {preview.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 font-lp-body text-[13.5px]">
              <span className="truncate font-bold text-[var(--m-ink)]">{item.title}</span>
              <span className="shrink-0 rounded bg-[var(--m-ground)] px-1.5 py-0.5 text-[11px] font-bold uppercase text-app-muted">{item.item_type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
