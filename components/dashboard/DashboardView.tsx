import { GraduationCap, Layers, School } from "lucide-react";
import type { DashboardData, SkillRow } from "@/lib/dashboard/data";
import type { CareerMatch } from "@/lib/career/skill-gap";
import { scoreTier, TIER_TEXT } from "@/components/dashboard/tier";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { SkillsTab } from "@/components/dashboard/SkillsTab";
import { SkillGapsTab } from "@/components/dashboard/SkillGapsTab";
import { VaultTab } from "@/components/dashboard/VaultTab";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";

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

export function DashboardView({
  data,
  skills,
  careerMatches,
}: {
  data: DashboardData;
  skills: SkillRow[];
  careerMatches: CareerMatch[];
}) {
  const initials = initialsOf(data.fullName, data.email);
  const yearLabel = formatYearSemester(data.year);
  const overallTier = scoreTier(data.overall.percentage);

  return (
    <main className="min-h-screen bg-lp-surface">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-lp-border-hairline bg-lp-surface-card shadow-sm">
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

        <div className="mt-6">
          <DashboardTabs
            overview={<OverviewTab data={data} />}
            skills={<SkillsTab skills={skills} />}
            skillGaps={<SkillGapsTab matches={careerMatches} />}
            vault={<VaultTab />}
          />
        </div>
      </div>
    </main>
  );
}
