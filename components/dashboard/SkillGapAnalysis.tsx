"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StationMark } from "@/components/roadmap/visual/StationMark";
import { STAGE_LABEL } from "@/components/roadmap/visual/meta";
import type { GapSkill } from "@/lib/dashboard/skill-groups";

const LINES = ["#b3265b", "#8b5a2b", "#d4202c", "#0b5cad", "#0d7a45", "#7a3e9d", "#007f86", "#b45309"];
const CRITICAL_GAP = 10;
type Filter = "all" | "focus" | "critical" | "unassessed";
const FILTERS: { id: Filter; label: string }[] = [{ id: "all", label: "All skills" }, { id: "focus", label: "Focus now" }, { id: "critical", label: "Critical gaps" }, { id: "unassessed", label: "Not assessed" }];

const gapOf = (s: GapSkill) => s.required - (s.score ?? 0);
const tierOf = (s: GapSkill) => (s.score === null ? "unassessed" : gapOf(s) <= 0 ? "met" : gapOf(s) <= CRITICAL_GAP ? "moderate" : "critical");
const stateOf = (s: GapSkill) => (s.score === null ? "NOT_ASSESSED" : s.score >= s.required ? "TARGET_MET" : s.score > 0 ? "LEARNING" : "NOT_STARTED") as "NOT_ASSESSED" | "TARGET_MET" | "LEARNING" | "NOT_STARTED";
const TIER_STYLE = { critical: "bg-[#fde8e8] text-[#9b1c1c]", moderate: "bg-[#fdf1d8] text-[#8a5a00]", met: "bg-[#def5e7] text-[#0d6b3a]", unassessed: "bg-[var(--m-ground)] text-[var(--m-muted)]" } as const;

/** Ring: how far you are toward the level the market asks for. The tick sits where the target is. */
function Ring({ score, required, color }: { score: number | null; required: number; color: string }) {
  const r = 26, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0)) / 100;
  const a = -Math.PI / 2 + Math.min(1, required / 100) * Math.PI * 2;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden className="shrink-0">
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--m-rule)" strokeWidth="7" />
      <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${pct * c} ${c}`} transform="rotate(-90 34 34)" />
      <line x1={34 + Math.cos(a) * (r - 7)} y1={34 + Math.sin(a) * (r - 7)} x2={34 + Math.cos(a) * (r + 7)} y2={34 + Math.sin(a) * (r + 7)} stroke="var(--m-ink)" strokeWidth="3" strokeLinecap="round" />
      <text x="34" y="38" textAnchor="middle" fontSize="13" fontWeight="700" className="fill-[var(--m-ink)]">{score === null ? "–" : `${score}`}</text>
    </svg>
  );
}

export function SkillGapAnalysis({ roleName, readiness, skills }: { roleName: string; readiness: number | null; skills: GapSkill[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");

  // Arena missions and assessments change the numbers elsewhere: re-read them whenever the student returns to this tab.
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [router]);

  const counts = useMemo(() => {
    const c = { critical: 0, moderate: 0, met: 0, unassessed: 0 };
    for (const s of skills) c[tierOf(s)] += 1;
    return c;
  }, [skills]);

  const priorities = useMemo(() => [...skills].filter((s) => tierOf(s) !== "met").sort((a, b) => gapOf(b) - gapOf(a) || Number(b.focus) - Number(a.focus)).slice(0, 4), [skills]);

  const areas = useMemo(() => {
    const visible = skills.filter((s) => filter === "all" || (filter === "focus" ? s.focus : tierOf(s) === filter));
    const m = new Map<string, GapSkill[]>();
    for (const s of visible) m.set(s.area, [...(m.get(s.area) ?? []), s]);
    return [...m.entries()].map(([area, list]) => {
      const all = skills.filter((s) => s.area === area);
      const measured = all.filter((s) => s.score !== null);
      const idx = [...new Set(skills.map((s) => s.area))].indexOf(area);
      return { area, list: [...list].sort((a, b) => gapOf(b) - gapOf(a)), color: LINES[idx % LINES.length], stage: all[0].stage, focus: all.some((s) => s.focus), measured: measured.length, total: all.length, avg: measured.length ? Math.round(measured.reduce((t, s) => t + (s.score ?? 0), 0) / measured.length) : null };
    }).sort((a, b) => Number(b.focus) - Number(a.focus));
  }, [skills, filter]);

  if (skills.length === 0) return <p className="rounded-xl border border-dashed border-[var(--m-off)] bg-white px-6 py-12 text-center font-lp-body text-[14px] text-app-muted">We don&apos;t have a skill list for {roleName} yet.</p>;

  const tiles = [
    { label: "Role readiness", value: readiness === null ? "–" : `${readiness}%`, tone: "text-[var(--m-ink)]" },
    { label: "Critical gaps", value: counts.critical, tone: "text-[#9b1c1c]" },
    { label: "Moderate gaps", value: counts.moderate, tone: "text-[#8a5a00]" },
    { label: "On target", value: counts.met, tone: "text-[#0d6b3a]" },
    { label: "Not assessed", value: counts.unassessed, tone: "text-[var(--m-muted)]" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Gap summary">
        {tiles.map((t) => (
          <li key={t.label} className="rounded-xl border border-[var(--m-rule)] bg-white p-4">
            <p className={`font-lp-display text-[28px] font-bold leading-none ${t.tone}`}>{t.value}</p>
            <p className="mt-1.5 text-[12px] text-app-muted">{t.label}</p>
          </li>
        ))}
      </ul>

      {priorities.length > 0 && (
        <section aria-labelledby="close-first">
          <h3 id="close-first" className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Close these first</h3>
          <p className="mt-0.5 text-[13px] text-app-muted">The biggest distance between you and what {roleName} roles ask for.</p>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {priorities.map((s) => (
              <li key={s.skill} className="flex items-center gap-3 rounded-xl border border-[var(--m-rule)] bg-white p-3.5">
                <Ring score={s.score} required={s.required} color="var(--m-accent)" />
                <div className="min-w-0">
                  <p className="truncate font-lp-body text-[14px] font-bold text-[var(--m-ink)]" title={s.skill}>{s.skill}</p>
                  <p className="text-[12px] text-app-muted">{s.score === null ? "Not assessed" : `${s.score}%`} → {s.required}%</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${TIER_STYLE[tierOf(s)]}`}>{s.score === null ? "Assess me" : `${gapOf(s)} pts to go`}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div role="group" aria-label="Filter skills" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${filter === f.id ? "bg-[var(--m-ink)] text-white" : "bg-white text-[var(--m-muted)] hover:text-[var(--m-ink)]"}`}>{f.label}</button>
        ))}
      </div>

      {areas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--m-off)] bg-white px-6 py-10 text-center text-[14px] text-app-muted">Nothing matches this filter right now.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {areas.map((d) => (
            <li key={d.area} className="rounded-xl border border-[var(--m-rule)] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 style={{ background: d.color }} className="rounded-full px-3.5 py-1 text-[14px] font-bold text-white">{d.area}</h3>
                <p className="text-right text-[13px] font-bold text-[var(--m-muted)]">{d.focus && <span className="mr-2 rounded bg-[var(--m-ink)] px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide text-white">Focus now</span>}{d.avg === null ? "Not assessed" : `${d.avg}%`} · {d.measured}/{d.total}</p>
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
                      <div className="relative mt-1.5 h-2 rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${s.skill}: ${s.score === null ? "not assessed" : `${s.score} percent`}, the market needs ${s.required} percent`}>
                        {s.score !== null && <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: d.color }} />}
                        <span aria-hidden className="absolute -top-1 h-4 w-[3px] rounded bg-[var(--m-ink)]" style={{ left: `calc(${Math.min(100, s.required)}% - 1px)` }} />
                      </div>
                      <p className="mt-1 flex items-center gap-2 text-[11.5px] text-app-muted">Market needs {s.required}%<span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${TIER_STYLE[tierOf(s)]}`}>{tierOf(s) === "met" ? "On target" : tierOf(s) === "unassessed" ? "Not assessed" : `${gapOf(s)} pts to go`}</span></p>
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
