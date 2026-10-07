import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DashboardData, SectionScore } from "@/lib/dashboard/data";
import { SECTION_ICON } from "@/components/section-icons";
import { scoreTier, TIER_BAR, TIER_CONTAINER, TIER_LABEL } from "@/components/dashboard/tier";

export function AssessmentResults({ data }: { data: DashboardData }) {
  const sections = data.sectionScores.filter((s) => s.section !== "career_interests");

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-lp-display text-[17px] font-semibold text-app-charcoal">Diagnostic assessment</h2>
          <p className="font-lp-body text-[12.5px] text-app-muted">
            A one-time baseline, not a verified skill — your Vault and Arena results carry more weight over time.
          </p>
        </div>
        <Link
          href="/assessment"
          className="hidden shrink-0 items-center gap-1 font-lp-mono text-[11px] font-semibold text-app-blue hover:underline sm:flex"
        >
          Retake assessment
          <ArrowUpRight size={12} />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((score) => (
          <SectionScoreCard key={score.section} score={score} />
        ))}
      </div>
    </section>
  );
}

function SectionScoreCard({ score }: { score: SectionScore }) {
  const Icon = SECTION_ICON[score.section];
  const tier = scoreTier(score.percentage);
  return (
    <Link
      href="/dashboard/skills?view=gaps"
      className="flex flex-col gap-3 rounded-xl border border-app-border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-app-background text-app-muted">
          <Icon size={17} />
        </span>
        <span className={`rounded-full px-2 py-0.5 font-lp-mono text-[10.5px] font-semibold ${TIER_CONTAINER[tier]}`}>
          {TIER_LABEL[tier]}
        </span>
      </div>
      <div>
        <p className="font-lp-body text-[13.5px] font-medium leading-snug text-app-charcoal">{score.label}</p>
        <p className="mt-0.5 font-lp-mono text-[11px] text-app-muted">
          {score.percentage}% · {score.correct}/{score.total} correct
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-app-background">
        <div className={`h-full rounded-full ${TIER_BAR[tier]}`} style={{ width: `${score.percentage}%` }} />
      </div>
    </Link>
  );
}
