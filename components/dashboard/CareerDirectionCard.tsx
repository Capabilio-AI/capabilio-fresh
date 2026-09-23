import Link from "next/link";
import { Compass } from "lucide-react";
import type { CareerMatch } from "@/lib/career/skill-gap";

const RECOMMENDATION_COPY: Record<CareerMatch["recommendation"], string> = {
  Ready: "Your capability profile already covers most of what this role needs.",
  Explore: "You're building toward this — a few focused skills will close most of the gap.",
  "Long-term pathway": "Early stage. This is a direction worth exploring over the next few years.",
};

export function CareerDirectionCard({ match }: { match: CareerMatch | null }) {
  if (!match) {
    return (
      <div className="rounded-xl border border-dashed border-app-border bg-white p-6 text-center">
        <Compass size={20} className="mx-auto text-app-muted" />
        <p className="mt-2 font-lp-body text-[13.5px] text-app-muted">
          Complete your assessment to see a recommended career direction.
        </p>
      </div>
    );
  }

  const onTrack = match.skillGaps.filter((g) => g.gap === 0).length;
  const needsWork = match.skillGaps.filter((g) => g.gap > 0).length;

  return (
    <div className="flex h-full flex-col rounded-xl border border-app-border bg-white p-5">
      <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-orange">
        <Compass size={14} />
        Recommended career direction
      </div>
      <h3 className="mt-2 font-lp-display text-[20px] font-semibold text-app-charcoal">{match.careerRole}</h3>
      <p className="mt-1 font-lp-body text-[13px] leading-relaxed text-app-muted">
        {RECOMMENDATION_COPY[match.recommendation]}
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between font-lp-mono text-[11px] text-app-muted">
          <span>Readiness</span>
          <span className="font-semibold text-app-charcoal">{match.overallReadiness}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-app-background">
          <div className="h-full rounded-full bg-app-orange" style={{ width: `${match.overallReadiness}%` }} />
        </div>
      </div>

      <div className="mt-4 flex gap-4 font-lp-mono text-[11px] text-app-muted">
        <span>
          <span className="font-semibold text-app-success">{onTrack}</span> on track
        </span>
        <span>
          <span className="font-semibold text-app-warning">{needsWork}</span> need development
        </span>
      </div>

      <div className="mt-5 flex gap-2">
        <Link
          href="/dashboard/career-path"
          className="flex-1 rounded-lg bg-app-charcoal px-3.5 py-2 text-center font-lp-body text-[12.5px] font-semibold text-white transition-transform hover:-translate-y-0.5"
        >
          View career path
        </Link>
        <Link
          href="/dashboard/career-path#explore"
          className="flex-1 rounded-lg border border-app-border px-3.5 py-2 text-center font-lp-body text-[12.5px] font-medium text-app-charcoal transition-colors hover:bg-app-background"
        >
          Explore careers
        </Link>
      </div>
    </div>
  );
}
