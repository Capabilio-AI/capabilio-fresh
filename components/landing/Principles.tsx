"use client";

import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { RotateCcw } from "lucide-react";
import ProofStream from "./ProofStream";

const PILLARS = [
  { t: "Evidence over decoration", b: "A level appears only when something measured it. Nothing on the map is self-reported." },
  { t: "Honest absence", b: "Not assessed is a real state. It stays flat on the map instead of passing as a zero or a pass." },
  { t: "One map, two readers", b: "The student and the advisor read the same record, so there is no private view that disagrees." },
];

const START = 400;
const CORRECT = 4;
const INCORRECT = -2;
const MAX_POINTS = 28;
const next = (r: number, d: number) => Math.max(0, r + d);

type Ev = { d: number; r: number };

function Ledger() {
  const [hist, setHist] = useState<number[]>([START]);
  const [log, setLog] = useState<Ev[]>([]);
  const rating = hist[hist.length - 1];
  const mv = useMotionValue(START);
  const shown = useTransform(mv, (v) => Math.round(v).toString());

  useEffect(() => {
    const c = animate(mv, rating, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [rating, mv]);

  const push = (ds: number[]) => {
    let r = rating;
    const h: number[] = [];
    const l: Ev[] = [];
    for (const d of ds) {
      r = next(r, d);
      h.push(r);
      l.push({ d, r });
    }
    setHist((p) => [...p, ...h].slice(-MAX_POINTS));
    setLog((p) => [...l.reverse(), ...p].slice(0, 4));
  };
  const reset = () => {
    setHist([START]);
    setLog([]);
  };
  const jump = () => {
    setHist([3]);
    setLog([]);
  };

  const vals = [...hist, START];
  const lo = Math.min(...vals) - 6;
  const hi = Math.max(...vals) + 6;
  const yOf = (v: number) => 130 - ((v - lo) / (hi - lo)) * 120;
  const pts =
    hist.length === 1
      ? ([[0, yOf(hist[0])], [400, yOf(hist[0])]] as const)
      : hist.map((v, i) => [(i * 400) / (hist.length - 1), yOf(v)] as const);
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <div className="rounded-3xl border border-white/15! bg-cap-night-2/80 p-5 sm:p-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-white/60">Data Analyst rating</div>
          <motion.div className="font-cap-display text-6xl font-semibold tabular-nums tracking-tight">{shown}</motion.div>
        </div>
        <button onClick={reset} aria-label="Reset the ledger" className="grid h-10 w-10 place-items-center rounded-full border border-white/25! text-white/80 hover:bg-white/10">
          <RotateCcw size={16} />
        </button>
      </div>

      <svg viewBox="0 0 400 140" className="mt-4 h-36 w-full" role="img" aria-label={`Rating history, now ${rating}`}>
        <line x1="0" x2="400" y1={yOf(START)} y2={yOf(START)} stroke="rgba(255,255,255,.28)" strokeDasharray="4 5" />
        <text x="396" y={yOf(START) - 5} textAnchor="end" fontSize="10" fill="rgba(255,255,255,.65)">start {START}</text>
        {lo <= 0 && (
          <>
            <line x1="0" x2="400" y1={yOf(0)} y2={yOf(0)} stroke="#ffb27a" strokeOpacity=".7" />
            <text x="396" y={yOf(0) - 5} textAnchor="end" fontSize="10" fill="#ffb27a">floor 0</text>
          </>
        )}
        <path d={path} fill="none" stroke="#ffb27a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r="5" fill="#ff5701" stroke="#fff" strokeWidth="2" />
      </svg>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <button onClick={() => push([CORRECT])} className="rounded-full bg-cap-orange px-5 py-2.5 text-sm font-semibold text-cap-ink hover:-translate-y-px">
          Correct answer +4
        </button>
        <button onClick={() => push([INCORRECT])} className="rounded-full border border-white/30! px-5 py-2.5 text-sm font-semibold hover:bg-white/10">
          Incorrect answer −2
        </button>
        <button
          onClick={() => push(Array.from({ length: 10 }, () => (Math.random() < 0.6 ? CORRECT : INCORRECT)))}
          className="rounded-full border border-white/30! px-5 py-2.5 text-sm font-semibold hover:bg-white/10"
        >
          Ten attempts
        </button>
        <button onClick={jump} className="px-2 py-2.5 text-sm font-medium text-cap-apricot underline">
          Jump to 3 to see the floor
        </button>
      </div>

      <ul className="mt-4 grid min-h-[4.5rem] gap-1.5 font-mono text-xs text-white/70" aria-live="polite">
        {log.length === 0 && <li className="break-words">No events yet. Every change lands here.</li>}
        {log.map((e, i) => (
          <li key={i} className="flex justify-between border-b border-white/10! pb-1.5">
            <span>{e.d > 0 ? "verified correct" : "verified incorrect"}</span>
            <span>
              {e.d > 0 ? "+" : "−"}{Math.abs(e.d)} → {e.r}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Principles() {
  return (
    <section id="principles" className="cap-night relative isolate overflow-hidden bg-cap-night px-5 py-20 text-cap-paper md:px-10 md:py-28">
      <div className="mx-auto max-w-[84rem]">
        <h2 data-rise className="max-w-4xl font-cap-display text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.03em]" style={{ textWrap: "balance" }}>
          Built so the numbers can be trusted.
        </h2>

        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-12">
          {PILLARS.map((p) => (
            <div key={p.t} data-rise className="border-t border-white/25! pt-6">
              <h3 className="font-cap-display text-2xl font-semibold tracking-tight">{p.t}</h3>
              <p className="mt-3 text-base leading-relaxed text-white/72">{p.b}</p>
            </div>
          ))}
        </div>

        <div className="mt-24 grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 [&>*]:min-w-0">
          <div>
            <h3 className="font-cap-display text-3xl font-semibold leading-tight tracking-tight md:text-5xl" style={{ textWrap: "balance" }}>
              Try the ledger. The rule is the same for everyone.
            </h3>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/72">
              A rating starts at {START}. A verified correct answer adds {CORRECT}, a verified incorrect one subtracts {Math.abs(INCORRECT)},
              and it never goes below zero. It only changes through a recorded result.
            </p>
            <ProofStream />
          </div>
          <div data-rise><Ledger /></div>
        </div>
      </div>
    </section>
  );
}
