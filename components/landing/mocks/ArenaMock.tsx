"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Play, RotateCcw } from "lucide-react";
import Window from "./Window";

const CHECKS = ["Query uses the new index", "Matches the reference on 3 datasets", "Runs under 200 ms on 100k rows"];
const START = 412;
const STEP_MS = 650;

export default function ArenaMock() {
  const [done, setDone] = useState(-1); // -1 idle, 0..n checks passed
  const [running, setRunning] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const run = () => {
    setRunning(true);
    setDone(0);
    let n = 0;
    const tick = () => {
      n += 1;
      setDone(n);
      if (n < CHECKS.length) timer.current = window.setTimeout(tick, STEP_MS);
      else setRunning(false);
    };
    timer.current = window.setTimeout(tick, STEP_MS);
  };
  const reset = () => {
    window.clearTimeout(timer.current);
    setRunning(false);
    setDone(-1);
  };
  const passed = done === CHECKS.length;

  return (
    <Window title="Arena · Ticket">
      <div className="p-4 sm:p-5">
        <div className="font-cap-display text-lg font-semibold leading-snug">The orders page times out for customers with 10,000+ orders.</div>
        <p className="mt-1 text-sm text-cap-muted">Fix the slow query. Your patch runs against hidden checks.</p>

        <pre className="mt-4 overflow-x-auto rounded-xl bg-cap-night p-4 font-mono text-[12.5px] leading-relaxed text-white/85">
          <span className="text-[#ff9b9b]">- SELECT * FROM orders WHERE user_id = $1;</span>
          {"\n"}
          <span className="text-[#8fe3b3]">+ CREATE INDEX CONCURRENTLY idx_orders_user ON orders (user_id);</span>
          {"\n"}
          <span className="text-[#8fe3b3]">+ SELECT id, total FROM orders WHERE user_id = $1;</span>
        </pre>

        <ul className="mt-4 grid gap-2">
          {CHECKS.map((c, i) => {
            const ok = done > i;
            const busy = running && done === i;
            return (
              <li key={c} className="flex items-center gap-3 rounded-lg border border-cap-line! px-3 py-2.5 text-sm">
                <span className={`grid h-5 w-5 place-items-center rounded-full ${ok ? "bg-cap-ok text-white" : "border border-cap-line! text-cap-muted"}`}>
                  {ok ? <Check size={13} strokeWidth={3} /> : busy ? <Loader2 size={13} className="animate-spin" /> : null}
                </span>
                {c}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-cap-mist p-4">
          <div>
            <div className="text-xs font-medium text-cap-muted">Data Analyst rating</div>
            <div className="font-cap-display text-3xl font-semibold tabular-nums">
              {passed ? START + 4 : START}
              {passed && <span className="ml-2 text-base font-semibold text-cap-ok">+4</span>}
            </div>
          </div>
          {passed ? (
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-full border border-cap-ink/25! px-4 py-2 text-sm font-semibold hover:bg-white">
              <RotateCcw size={15} /> Reset
            </button>
          ) : (
            <button
              onClick={run}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-full bg-cap-ink px-5 py-2.5 text-sm font-semibold text-cap-paper disabled:opacity-60"
            >
              <Play size={15} /> Run checks
            </button>
          )}
        </div>
      </div>
    </Window>
  );
}
