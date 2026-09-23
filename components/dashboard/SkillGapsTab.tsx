import type { CareerMatch } from "@/lib/career/skill-gap";
import { EmptyState } from "@/components/dashboard/SkillsTab";

const RECOMMENDATION_CLASSES: Record<CareerMatch["recommendation"], string> = {
  Ready: "bg-lp-success-container text-lp-on-success-container",
  Explore: "bg-lp-accent-ochre/15 text-lp-accent-ochre",
  "Long-term pathway": "bg-lp-surface-subtle text-lp-text-muted",
};

export function SkillGapsTab({ matches }: { matches: CareerMatch[] }) {
  if (matches.length === 0) {
    return <EmptyState message="No career requirements to compare against yet." />;
  }

  return (
    <div className="flex flex-col gap-5">
      {matches.map((match) => (
        <div key={match.careerRole} className="rounded-xl border border-lp-border-hairline bg-lp-surface-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
              {match.careerRole}
            </h3>
            <span
              className={`rounded-full px-3 py-1 font-lp-mono text-lp-label-sm font-semibold ${RECOMMENDATION_CLASSES[match.recommendation]}`}
            >
              {match.recommendation} — {match.overallReadiness}% ready
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {match.skillGaps.map((gap) => (
              <div key={gap.skill}>
                <div className="flex items-center justify-between font-lp-mono text-lp-label-sm text-lp-text-muted">
                  <span>{gap.skill}</span>
                  <span>
                    {gap.current ?? 0} / {gap.required}
                    {gap.gap > 0 && <span className="ml-1.5 text-lp-error">(-{gap.gap})</span>}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-lp-surface-subtle">
                  <div
                    className={`h-full rounded-full ${gap.gap > 0 ? "bg-lp-accent-ochre" : "bg-lp-success"}`}
                    style={{ width: `${Math.min(100, ((gap.current ?? 0) / gap.required) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
