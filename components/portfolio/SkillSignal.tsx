"use client";

import { useEffect, useState } from "react";

export interface SignalSkill {
  name: string;
  score: number;
  evidenceCount: number;
  /** What the target role asks for, when known. */
  targetLevel: number | null;
}

const CELLS = 20;
const STAGGER_MS = 16;

/**
 * Measured skills as an instrument panel: every skill is a 20-cell signal strip that lights up to its measured score, with a white tick
 * where the target role needs it to be. The numbers are the graded scores; the strip is only another way to read them.
 */
export function SkillSignal({ skills }: { skills: SignalSkill[] }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl bg-[var(--m-ink)] p-5 text-white [print-color-adjust:exact] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h3 className="font-lp-display text-[16px] font-bold">Skill signal</h3>
        <p className="flex items-center gap-4 font-lp-mono text-[11.5px] text-white/70" aria-hidden>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-3.5 rounded-[2px] bg-[var(--m-accent)]" />measured</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-3.5 w-0.5 bg-white" />role target</span>
        </p>
      </div>

      <ul className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {skills.map((s, row) => {
          const lit = Math.round((Math.min(100, s.score) / 100) * CELLS);
          const gap = s.targetLevel !== null ? Math.max(0, s.targetLevel - s.score) : null;
          return (
            <li key={s.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-lp-body text-[13.5px] font-bold">{s.name}</span>
                <span className="font-lp-mono text-[13px] tabular-nums">{s.score}<span className="text-white/60">%</span></span>
              </div>
              <div className="relative mt-2" aria-hidden>
                <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${CELLS}, minmax(0, 1fr))` }}>
                  {Array.from({ length: CELLS }, (_, i) => {
                    const isLit = i < lit;
                    return (
                      <span key={i} className={`h-3.5 rounded-[2px] transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${isLit ? "bg-[var(--m-accent)]" : "bg-white/12"}`}
                        style={{ opacity: on || !isLit ? 1 : 0.15, transform: on || !isLit ? "none" : "scaleY(0.4)", transitionDelay: on ? `${(row * 2 + i) * STAGGER_MS}ms` : "0ms" }} />
                    );
                  })}
                </div>
                {s.targetLevel !== null && <span className="absolute -top-1 -bottom-1 w-0.5 bg-white" style={{ left: `calc(${Math.min(100, s.targetLevel)}% - 1px)` }} />}
              </div>
              <p className="mt-1.5 font-lp-mono text-[11.5px] text-white/60">
                {s.evidenceCount} evidence{gap !== null ? ` · ${gap > 0 ? `${gap} pts to target` : "target met"}` : ""}
              </p>
              <span className="sr-only">{`${s.name}: ${s.score} percent${s.targetLevel !== null ? `, target ${s.targetLevel} percent` : ""}.`}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 font-lp-body text-[12.5px] text-white/60">Scores come from graded assessments and challenges on Capabilio, not self-reported.</p>
    </div>
  );
}
