"use client";

import { useEffect, useState } from "react";
import { BookOpen, ClipboardCheck, FileCheck2, FolderCheck, MapPinned, Swords } from "lucide-react";

const STEPS = [
  { icon: ClipboardCheck, t: "Assessment", d: "Measure what you actually know" },
  { icon: MapPinned, t: "Career map", d: "See the path and the next stop" },
  { icon: BookOpen, t: "SkillStudio", d: "Build the skills the map asks for" },
  { icon: Swords, t: "Arena", d: "Prove them on real tickets" },
  { icon: FolderCheck, t: "Portfolio", d: "Verified work, one live rating" },
  { icon: FileCheck2, t: "Skill Passport", d: "Share proof anyone can check" },
];
const STEP_MS = 2300;

export default function HeroPipeline() {
  const [on, setOn] = useState(0);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (hold || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setOn((n) => (n + 1) % STEPS.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [hold]);

  return (
    <div className="cap-win w-[21.5rem] rounded-3xl bg-white/95 p-6" onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)}>
      <ol aria-label="How proof is built">
        {STEPS.map((s, n) => {
          const Icon = s.icon;
          const active = n === on;
          const done = n < on;
          return (
            <li key={s.t} className="relative">
              {n < STEPS.length - 1 && (
                <span aria-hidden="true" className="absolute left-[21px] top-11 h-[calc(100%-2.75rem)] w-px bg-cap-line">
                  <span className={`block w-full origin-top bg-cap-orange transition-transform duration-500 ${done ? "scale-y-100" : "scale-y-0"}`} style={{ height: "100%" }} />
                </span>
              )}
              <button type="button" onClick={() => setOn(n)} aria-current={active ? "step" : undefined} className="flex w-full items-start gap-4 py-2 text-left">
                <span
                  className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-all duration-300 ${
                    active ? "scale-110 border-cap-orange! bg-cap-orange text-cap-ink" : done ? "border-cap-orange/50! bg-cap-peach text-cap-orange" : "border-cap-line! bg-white text-cap-muted"
                  }`}
                >
                  <Icon size={19} strokeWidth={1.75} />
                  {active && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-xl border border-cap-orange/60!" />}
                </span>
                <span className="pt-1">
                  <span className={`block text-[15px] font-semibold transition-colors ${active ? "text-cap-ink" : "text-cap-ink/70"}`}>{s.t}</span>
                  <span className={`block overflow-hidden text-[13px] leading-snug text-cap-muted transition-all duration-300 ${active ? "mt-0.5 max-h-10 opacity-100" : "max-h-0 opacity-0"}`}>{s.d}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 border-t border-cap-line! pt-4 text-[13px] text-cap-muted">Every step is logged. Nothing is self-reported.</p>
    </div>
  );
}
