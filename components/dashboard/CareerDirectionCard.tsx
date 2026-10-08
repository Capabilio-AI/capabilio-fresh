import Link from "next/link";
import { Compass } from "lucide-react";
import type { CareerMatch } from "@/lib/career/skill-gap";

const RECOMMENDATION_COPY: Record<CareerMatch["recommendation"], string> = {
  Ready: "Your capability profile already covers most of what this role needs.",
  Explore: "You're building toward this. A few focused skills will close most of the gap.",
  "Long-term pathway": "Early stage. This is a direction worth exploring over the next few years.",
};

export function CareerDirectionCard({ match }: { match: CareerMatch | null }) {
  if (!match) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--m-off)] bg-white p-6 text-center">
        <Compass size={22} className="mx-auto text-[var(--m-muted)]" aria-hidden />
        <p className="mt-2 font-lp-body text-[13.5px] text-app-muted">Complete your assessment to see a recommended career direction.</p>
      </div>
    );
  }
  const onTrack = match.skillGaps.filter((g) => g.gap === 0).length;
  const needsWork = match.skillGaps.filter((g) => g.gap > 0).length;
  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--m-rule)] bg-white p-5">
      <p className="flex items-center gap-2 text-[13px] font-bold text-[var(--m-muted)]"><Compass size={15} aria-hidden />Recommended career direction</p>
      <h3 className="mt-2 font-lp-display text-[26px] font-bold leading-tight text-[var(--m-ink)]">{match.careerRole}</h3>
      <p className="mt-1 font-lp-body text-[13.5px] leading-relaxed text-app-muted">{RECOMMENDATION_COPY[match.recommendation]}</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between"><span className="text-[13px] font-bold text-[var(--m-muted)]">Readiness</span><span className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">{match.overallReadiness}%</span></div>
        <div className="relative mt-2 h-[10px] rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${match.overallReadiness} percent ready`}>
          <div className="h-full rounded-full bg-[var(--m-ink)]" style={{ width: `${match.overallReadiness}%` }} />
          <span aria-hidden className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--m-ink)] bg-white" style={{ left: `${Math.min(97, Math.max(3, match.overallReadiness))}%` }} />
        </div>
      </div>

      <p className="mt-4 flex gap-5 text-[13px] text-app-muted">
        <span><span className="font-bold text-[#0d7a45]">{onTrack}</span> on track</span>
        <span><span className="font-bold text-[#b45309]">{needsWork}</span> need development</span>
      </p>

      <div className="mt-auto flex gap-2 pt-5">
        <Link href="/dashboard/skills?view=gaps" className="flex-1 rounded-lg bg-[var(--m-ink)] px-3.5 py-2.5 text-center font-lp-body text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">See skill gaps</Link>
        <Link href="/dashboard/roadmap" className="flex-1 rounded-lg border border-[var(--m-ink)] px-3.5 py-2.5 text-center font-lp-body text-[13px] font-bold text-[var(--m-ink)] transition-colors hover:bg-[var(--m-ground)]">Open roadmap</Link>
      </div>
    </div>
  );
}
