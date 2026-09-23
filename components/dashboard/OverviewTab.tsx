import type { DashboardData, SectionScore } from "@/lib/dashboard/data";
import { SECTION_ICON } from "@/components/section-icons";
import { scoreTier, TIER_BAR, TIER_TEXT } from "@/components/dashboard/tier";

export function OverviewTab({ data }: { data: DashboardData }) {
  return (
    <div>
      <h2 className="mb-3 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">Section scores</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.sectionScores.map((score) => (
          <SectionScoreCard key={score.section} score={score} />
        ))}
      </div>
    </div>
  );
}

function SectionScoreCard({ score }: { score: SectionScore }) {
  const Icon = SECTION_ICON[score.section];
  const tier = scoreTier(score.percentage);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-lp-border-hairline bg-lp-surface-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-lp-surface-subtle text-lp-text-muted">
          <Icon size={17} />
        </span>
        <span className={`font-lp-display text-lp-headline-sm font-semibold ${TIER_TEXT[tier]}`}>
          {score.percentage}%
        </span>
      </div>
      <div>
        <p className="font-lp-body text-lp-body-sm font-medium text-lp-text-ink">{score.label}</p>
        <p className="mt-0.5 font-lp-mono text-lp-label-sm text-lp-text-muted">
          {score.correct} / {score.total} correct
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-lp-surface-subtle">
        <div className={`h-full rounded-full ${TIER_BAR[tier]}`} style={{ width: `${score.percentage}%` }} />
      </div>
    </div>
  );
}
