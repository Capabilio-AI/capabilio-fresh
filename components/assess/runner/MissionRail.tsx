"use client";

import { Gauge, Target } from "lucide-react";
import type { Difficulty } from "@/lib/assess/config";
import type { HistoryItem, SessionState } from "@/lib/assess/types";
import { useCountUp } from "../hooks/useCountUp";

const LEVEL: Record<Difficulty, number> = { EASY: 1, MEDIUM: 2, HARD: 3 };

/**
 * The live "how am I doing" rail. Everything here is computed from the answers actually given (and the ledger's rating), so it can
 * never show something that did not happen: no invented streaks, no fake percentiles.
 */
export function MissionRail({ state, history, elo, isCareer, currentSkill, total }: { state: SessionState; history: HistoryItem[]; elo: { start: number; now: number } | null; isCareer: boolean; currentSkill: string; total: number }) {
  const shown = useCountUp(elo?.now ?? 0);
  const covered = new Set(history.map((h) => h.group));
  const net = elo ? elo.now - elo.start : 0;
  return (
    <aside className="flex flex-col gap-4" aria-label="Your progress this session">
      {isCareer && elo && (
        <section className="a-glass-ink rounded-3xl p-5" aria-label="Role rating">
          <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white/65"><Gauge className="h-3.5 w-3.5" aria-hidden /> {state.careerName} ELO</p>
          <p className="mt-1 flex items-baseline gap-2.5">
            <span className="font-lp-display text-[48px] font-bold leading-none tabular-nums" aria-label={`ELO ${elo.now}`}>{shown}</span>
            {net !== 0 && <span className={`text-[14px] font-bold ${net > 0 ? "text-emerald-300" : "text-rose-300"}`}>{net > 0 ? "+" : "−"}{Math.abs(net)} this session</span>}
          </p>
          <p className="mt-1 text-[12px] text-white/60">Started at {elo.start}. +4 for a correct answer, −2 for an incorrect one.</p>
        </section>
      )}

      {isCareer && history.length > 0 && (
        <section className="a-glass rounded-3xl p-5" aria-label="Adaptive path">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--m-muted)]">Adaptive path</p>
          <AdaptivePath history={history} />
          <p className="mt-1 text-[12px] leading-snug text-[var(--m-muted)]">Questions get harder when you&apos;re right and ease when you&apos;re not.</p>
        </section>
      )}

      <section className="a-glass rounded-3xl p-5" aria-label="Coverage">
        <p className="flex items-center justify-between text-[12px] font-bold uppercase tracking-wider text-[var(--m-muted)]">
          <span className="flex items-center gap-2"><Target className="h-3.5 w-3.5" aria-hidden /> {isCareer ? "Skills covered" : "Sections"}</span>
          <span className="tabular-nums">{covered.size}/{state.roleSkills.length}</span>
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {state.roleSkills.map((s) => {
            const lit = covered.has(s.name);
            const now = s.name === currentSkill;
            return (
              <li key={s.name} className={`rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors duration-500 ${now ? "bg-[var(--m-ink)] text-white" : lit ? "bg-[var(--ok-soft)] text-[var(--ok-ink)]" : "bg-[var(--m-ink)]/6 text-[var(--m-off)]"}`}>
                {lit && !now && <span className="sr-only">Covered: </span>}{s.name}
              </li>
            );
          })}
        </ul>
        <p className="sr-only">{total} questions in total.</p>
      </section>
    </aside>
  );
}

function AdaptivePath({ history }: { history: HistoryItem[] }) {
  const W = 220;
  const H = 54;
  const xs = (i: number) => 8 + (history.length === 1 ? 0 : (i / (history.length - 1)) * (W - 16));
  const y = (d: Difficulty) => H - 8 - ((LEVEL[d] - 1) / 2) * (H - 16);
  const pts = history.map((h, i) => `${xs(i).toFixed(1)},${y(h.difficulty).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full" role="img" aria-label={`Difficulty of your last ${history.length} questions: ${history.map((h) => h.difficulty.toLowerCase()).join(", ")}`}>
      {[1, 2, 3].map((l) => <line key={l} x1="0" x2={W} y1={H - 8 - ((l - 1) / 2) * (H - 16)} y2={H - 8 - ((l - 1) / 2) * (H - 16)} stroke="rgb(23 19 31 / 0.08)" />)}
      <polyline points={pts} fill="none" stroke="var(--m-ink)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />
      {history.map((h, i) => <circle key={h.position} cx={xs(i)} cy={y(h.difficulty)} r="3.4" fill={h.correct ? "var(--ok)" : "var(--bad)"} stroke="#fff" strokeWidth="1.2" />)}
    </svg>
  );
}
