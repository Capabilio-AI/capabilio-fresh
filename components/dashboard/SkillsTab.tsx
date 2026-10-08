"use client";

import { useMemo } from "react";
import Link from "next/link";
import { RoundRadar } from "@/components/metro/RoundRadar";
import type { Stage } from "@/lib/roadmap-visual/graph-types";
import { STAGE_LABEL } from "@/components/roadmap/visual/meta";
import { StationMark } from "@/components/roadmap/visual/StationMark";

/** One skill the student's career asks for. score is null until something measures it. */
export interface CareerSkill {
  skill: string;
  domain: string;
  score: number | null;
  required: number;
  /** roadmap stage of the area this skill belongs to; absent when the career has no roadmap yet */
  stage?: Stage;
  /** true when this stage is what a student at their year should be working on */
  focus?: boolean;
}

const RADAR_MAX = 12;
const LINES = ["#d4202c", "#0b5cad", "#0d7a45", "#b45309", "#7a3e9d", "#007f86", "#c2185b", "#8b5a2b"];

function stateOf(s: CareerSkill) {
  if (s.score === null) return "NOT_ASSESSED" as const;
  if (s.score >= s.required) return "TARGET_MET" as const;
  return s.score > 0 ? ("LEARNING" as const) : ("NOT_STARTED" as const);
}

/**
 * The skill graph for the student's own career and nothing else: every skill the career asks for, grouped by domain, each domain a line and each
 * skill a station on it. Scores are plain percentages; a skill nobody has measured says so instead of showing 0.
 */
export function SkillsTab({ careerName, skills }: { careerName: string | null; skills: CareerSkill[] }) {
  const domains = useMemo(() => {
    const m = new Map<string, CareerSkill[]>();
    for (const s of skills) m.set(s.domain, [...(m.get(s.domain) ?? []), s]);
    return [...m.entries()].map(([domain, list], i) => {
      const measured = list.filter((s) => s.score !== null);
      return { domain, list: [...list].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)), color: LINES[i % LINES.length], stage: list[0].stage, focus: Boolean(list[0].focus), avg: measured.length ? Math.round(measured.reduce((t, s) => t + (s.score ?? 0), 0) / measured.length) : null, measured: measured.length };
    }).sort((a, b) => Number(b.focus) - Number(a.focus));
  }, [skills]);

  if (!careerName) return <EmptyState message="Choose a career direction and its skills appear here as a graph." action={{ href: "/dashboard/roadmap", label: "Choose a career" }} />;
  if (skills.length === 0) return <EmptyState message={`We don't have a skill list for ${careerName} yet.`} />;

  // A radar reads up to about a dozen axes; a bigger career falls back to one axis per stage.
  const radar = domains.length <= RADAR_MAX
    ? domains.map((d) => ({ subject: d.domain, score: d.avg }))
    : (Object.keys(STAGE_LABEL) as Stage[]).flatMap((st) => {
        const inStage = domains.filter((d) => d.stage === st && d.avg !== null);
        return inStage.length ? [{ subject: STAGE_LABEL[st], score: Math.round(inStage.reduce((t, d) => t + (d.avg ?? 0), 0) / inStage.length) as number | null }] : [];
      });
  const measuredTotal = skills.filter((s) => s.score !== null).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Skill graph: {careerName}</h2>
        <p className="mt-1 max-w-[70ch] font-lp-body text-[13.5px] text-app-muted">
          Every skill area this career needs, with what to focus on at your year first. {measuredTotal} of {skills.length} measured so far; the rest say &ldquo;Not assessed&rdquo; until a diagnostic, Arena challenge or project measures them.
        </p>
      </div>

      {radar.length >= 3 && (
        <div className="rounded-xl border border-[var(--m-rule)] bg-white p-4">
          <RoundRadar caption={`${careerName} skill areas`} axes={radar.map((r) => ({ label: r.subject, value: r.score }))} />
        </div>
      )}

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {domains.map((d) => (
          <li key={d.domain} className={`rounded-xl border bg-white p-4 ${d.focus || d.stage === undefined ? "border-[var(--m-rule)]" : "border-[var(--m-rule)] opacity-90"}`}>
            <div className="flex items-center justify-between gap-3">
              <h3 style={{ background: d.color }} className="rounded-full px-3.5 py-1 text-[14px] font-bold text-white">{d.domain}</h3>
              <p className="text-right text-[13px] font-bold text-[var(--m-muted)]">{d.focus && <span className="mr-2 rounded bg-[var(--m-ink)] px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide text-white">Focus now</span>}{d.avg === null ? "Not assessed" : `${d.avg}%`} · {d.measured}/{d.list.length}</p>
            </div>
            {d.stage && <p className="mt-2 text-[12px] text-app-muted">{STAGE_LABEL[d.stage]}{d.focus ? "" : " · comes later in your degree"}</p>}
            <ol className="relative mt-4 space-y-4">
              <span aria-hidden className="absolute bottom-3 left-[10px] top-3 w-[5px] rounded-full" style={{ background: d.color }} />
              {d.list.map((s) => (
                <li key={s.skill} className="relative flex items-start gap-3">
                  <span className="relative z-10 mt-0.5"><StationMark status={stateOf(s)} color={d.color} size={22} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{s.skill}</p>
                      <p className={`shrink-0 font-lp-display text-[16px] font-bold ${s.score === null ? "text-[var(--m-muted)]" : "text-[var(--m-ink)]"}`}>{s.score === null ? "Not assessed" : `${s.score}%`}</p>
                    </div>
                    <div className="relative mt-1.5 h-2 rounded-full bg-[var(--m-ground)]" role="img" aria-label={s.score === null ? `${s.skill}: not assessed, target ${s.required} percent` : `${s.skill}: ${s.score} percent, target ${s.required} percent`}>
                      {s.score !== null && <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: d.color }} />}
                      <span aria-hidden className="absolute -top-1 h-4 w-[3px] rounded bg-[var(--m-ink)]" style={{ left: `calc(${Math.min(100, s.required)}% - 1px)` }} />
                    </div>
                    <p className="mt-1 text-[11.5px] text-app-muted">Target {s.required}%</p>
                  </div>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--m-off)] bg-white px-6 py-12 text-center">
      <p className="font-lp-body text-[14px] text-app-muted">{message}</p>
      {action && <Link href={action.href} className="mt-4 inline-block rounded-lg bg-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-white">{action.label}</Link>}
    </div>
  );
}
