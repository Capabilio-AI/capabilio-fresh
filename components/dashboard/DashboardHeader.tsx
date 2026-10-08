import { GraduationCap, Layers, School } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/data";
import { scoreTier, TIER_LABEL } from "@/components/dashboard/tier";

const CHIP = "flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[12px] font-bold text-white";

export function DashboardHeader({ data }: { data: DashboardData }) {
  const tier = scoreTier(data.overall.percentage);
  return (
    <header className="mb-4 flex flex-col gap-5 rounded-2xl bg-[var(--m-ink)] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 font-lp-display text-[28px] font-bold leading-tight sm:text-[34px]">
          <svg width="44" height="14" viewBox="0 0 44 14" aria-hidden className="shrink-0"><path d="M3 7h38" stroke="#fff" strokeWidth="4" strokeLinecap="round" /><circle cx="3" cy="7" r="3" className="fill-[var(--m-ink)]" stroke="#fff" strokeWidth="2.5" /><circle cx="22" cy="7" r="3" className="fill-[var(--m-ink)]" stroke="#fff" strokeWidth="2.5" /><circle cx="41" cy="7" r="3" className="fill-[var(--m-ink)]" stroke="#fff" strokeWidth="2.5" /></svg>
          <span className="min-w-0 break-words">{data.fullName ?? "Student"}</span>
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.collegeName && <span className={CHIP}><School size={13} aria-hidden />{data.collegeName}</span>}
          {data.branch && <span className={CHIP}><Layers size={13} aria-hidden />{data.branch}</span>}
          {data.yearLabel && <span className={CHIP}><GraduationCap size={13} aria-hidden />{data.yearLabel}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 rounded-xl bg-white px-5 py-3 text-[var(--m-ink)]">
        <div>
          <p className="font-lp-display text-[34px] font-bold leading-none">{data.overall.percentage}%</p>
          <p className="mt-1 text-[12px] font-bold text-[var(--m-muted)]">Diagnostic score</p>
        </div>
        <span className="rounded-full bg-[var(--m-ground)] px-3 py-1 text-[12px] font-bold">{TIER_LABEL[tier]}</span>
      </div>
    </header>
  );
}
