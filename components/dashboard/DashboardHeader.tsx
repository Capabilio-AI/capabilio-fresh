import { GraduationCap, Layers, School } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/data";
import { scoreTier, TIER_CONTAINER, TIER_LABEL } from "@/components/dashboard/tier";

function formatYearSemester(year: string | null): string | null {
  if (!year) return null;
  const [y, s] = year.split("-");
  const ordinal: Record<string, string> = { "1": "1st", "2": "2nd", "3": "3rd", "4": "4th" };
  return `${ordinal[y] ?? y} Year, Sem ${s}`;
}

export function DashboardHeader({ data }: { data: DashboardData }) {
  const yearLabel = formatYearSemester(data.year);
  const tier = scoreTier(data.overall.percentage);

  return (
    <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-lp-display text-[26px] font-semibold tracking-tight text-app-charcoal sm:text-[32px]">
          {data.fullName ?? "Student"}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.collegeName && (
            <span className="flex items-center gap-1.5 rounded-full border border-app-border bg-white px-3 py-1 font-lp-mono text-[11px] text-app-muted">
              <School size={12} />
              {data.collegeName}
            </span>
          )}
          {data.branch && (
            <span className="flex items-center gap-1.5 rounded-full border border-app-border bg-white px-3 py-1 font-lp-mono text-[11px] text-app-muted">
              <Layers size={12} />
              {data.branch}
            </span>
          )}
          {yearLabel && (
            <span className="flex items-center gap-1.5 rounded-full border border-app-border bg-white px-3 py-1 font-lp-mono text-[11px] text-app-muted">
              <GraduationCap size={12} />
              {yearLabel}
            </span>
          )}
        </div>
      </div>

      <div className={`flex shrink-0 items-center gap-4 rounded-xl border border-app-border bg-white px-5 py-3`}>
        <div className="text-right">
          <p className="font-lp-display text-[26px] font-semibold leading-none text-app-charcoal">
            {data.overall.percentage}%
          </p>
          <p className="mt-1 font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">
            Diagnostic score · {data.overall.correct}/{data.overall.total}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 font-lp-mono text-[11px] font-semibold ${TIER_CONTAINER[tier]}`}>
          {TIER_LABEL[tier]}
        </span>
      </div>
    </div>
  );
}
