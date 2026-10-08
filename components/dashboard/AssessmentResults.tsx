import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DashboardData, SectionScore } from "@/lib/dashboard/data";
import { SECTION_ICON } from "@/components/section-icons";
import { scoreTier, TIER_LABEL } from "@/components/dashboard/tier";

const BAR = { high: "#0d7a45", mid: "#b45309", low: "var(--m-ink)" } as const;

export function AssessmentResults({ data }: { data: DashboardData }) {
  const sections = data.sectionScores.filter((s) => s.section !== "career_interests");
  return (
    <section aria-labelledby="diag-h">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="diag-h" className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Diagnostic assessment</h2>
          <p className="font-lp-body text-[13px] text-app-muted">A one-time baseline, not a verified skill. Your Vault and Arena results carry more weight over time.</p>
        </div>
        <Link href="/assessment" className="hidden shrink-0 items-center gap-1 text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline sm:flex">
          Retake assessment <ArrowUpRight size={14} aria-hidden />
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((score) => <li key={score.section}><SectionScoreCard score={score} /></li>)}
      </ul>
    </section>
  );
}

function SectionScoreCard({ score }: { score: SectionScore }) {
  const Icon = SECTION_ICON[score.section];
  const tier = scoreTier(score.percentage);
  return (
    <Link href="/dashboard/skills?view=gaps" className="group flex h-full flex-col gap-3 rounded-xl border border-[var(--m-rule)] bg-white p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--m-ink)] hover:shadow-[0_8px_20px_-8px_rgba(20,20,20,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--m-ground)] text-[var(--m-ink)]"><Icon size={18} aria-hidden /></span>
        <span className="text-[12px] font-bold text-[var(--m-muted)]">{TIER_LABEL[tier]}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="font-lp-body text-[14px] font-bold leading-snug text-[var(--m-ink)]">{score.label}</p>
        <p className="font-lp-display text-[28px] font-bold leading-none text-[var(--m-ink)]">{score.percentage}%</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${score.percentage} percent`}>
        <div className="h-full rounded-full" style={{ width: `${score.percentage}%`, background: BAR[tier] }} />
      </div>
    </Link>
  );
}
