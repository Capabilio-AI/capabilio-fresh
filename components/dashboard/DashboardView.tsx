import { GraduationCap, Layers, School } from "lucide-react";
import type { DashboardData, SectionScore } from "@/lib/dashboard/data";
import { BrandBackdrop } from "@/components/BrandBackdrop";
import { SECTION_ICON } from "@/components/section-icons";

function initialsOf(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function formatYearSemester(year: string | null): string | null {
  if (!year) return null;
  const [y, s] = year.split("-");
  const ordinal: Record<string, string> = { "1": "1st", "2": "2nd", "3": "3rd", "4": "4th" };
  return `${ordinal[y] ?? y} Year, Sem ${s}`;
}

function scoreTier(percentage: number): "high" | "mid" | "low" {
  if (percentage >= 80) return "high";
  if (percentage >= 50) return "mid";
  return "low";
}

const TIER_BAR: Record<ReturnType<typeof scoreTier>, string> = {
  high: "bg-lp-success",
  mid: "bg-lp-accent-ochre",
  low: "bg-lp-error",
};
const TIER_TEXT: Record<ReturnType<typeof scoreTier>, string> = {
  high: "text-lp-success",
  mid: "text-lp-accent-ochre",
  low: "text-lp-error",
};

export function DashboardView({ data }: { data: DashboardData }) {
  const initials = initialsOf(data.fullName, data.email);
  const yearLabel = formatYearSemester(data.year);
  const overallTier = scoreTier(data.overall.percentage);

  return (
    <BrandBackdrop>
      <div className="flex w-full max-w-4xl flex-col gap-6">
        <div className="overflow-hidden rounded-2xl border border-lp-border-hairline bg-lp-surface-card shadow-lg shadow-black/[0.04]">
          <div className="h-1.5 w-full bg-gradient-to-r from-lp-accent-indigo to-lp-accent-ochre" />
          <div className="flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lp-accent-indigo to-lp-accent-ochre font-lp-display text-lp-headline-md font-semibold text-lp-surface-card shadow-md">
                {initials}
              </div>
              <div>
                <h1 className="font-lp-display text-lp-headline-md font-semibold text-lp-text-ink">
                  {data.fullName ?? "Student"}
                </h1>
                <p className="mt-0.5 font-lp-body text-lp-body-sm text-lp-text-muted">{data.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.collegeName && (
                    <span className="flex items-center gap-1.5 rounded-full border border-lp-border-hairline bg-lp-surface-subtle px-3 py-1 font-lp-mono text-lp-label-sm text-lp-text-muted">
                      <School size={12} />
                      {data.collegeName}
                    </span>
                  )}
                  {data.branch && (
                    <span className="flex items-center gap-1.5 rounded-full border border-lp-border-hairline bg-lp-surface-subtle px-3 py-1 font-lp-mono text-lp-label-sm text-lp-text-muted">
                      <Layers size={12} />
                      {data.branch}
                    </span>
                  )}
                  {yearLabel && (
                    <span className="flex items-center gap-1.5 rounded-full border border-lp-border-hairline bg-lp-surface-subtle px-3 py-1 font-lp-mono text-lp-label-sm text-lp-text-muted">
                      <GraduationCap size={12} />
                      {yearLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center rounded-xl border border-lp-border-hairline bg-lp-surface-subtle px-6 py-4 text-center">
              <span className={`font-lp-display text-lp-display-mobile font-semibold ${TIER_TEXT[overallTier]}`}>
                {data.overall.percentage}%
              </span>
              <span className="font-lp-mono text-lp-label-sm uppercase tracking-wide text-lp-text-muted">
                Overall Score
              </span>
              <span className="mt-1 font-lp-body text-lp-body-sm text-lp-text-muted">
                {data.overall.correct} / {data.overall.total} correct
              </span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
            Section scores
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.sectionScores.map((score) => (
              <SectionScoreCard key={score.section} score={score} />
            ))}
          </div>
        </div>
      </div>
    </BrandBackdrop>
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
