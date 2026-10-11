"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 700;
const CHIP_MS = 6_000;

/** A number that counts to its new value when live data changes, with a brief "+12" chip so a recruiter watching sees what just moved. */
export function LiveNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(value);
  const [delta, setDelta] = useState(0);
  const from = useRef(value);

  useEffect(() => {
    if (from.current === value) return;
    const start = from.current;
    const change = value - start;
    from.current = value;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / DURATION_MS);
      setShown(Math.round(start + change * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(reduce ? () => setShown(value) : step);
    const show = setTimeout(() => setDelta(change), 0);
    const chip = setTimeout(() => setDelta(0), CHIP_MS);
    return () => { cancelAnimationFrame(frame); clearTimeout(show); clearTimeout(chip); };
  }, [value]);

  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span>{shown}{suffix}</span>
      {delta !== 0 && <span className={`rounded-full px-1.5 py-0.5 font-lp-mono text-[11px] font-bold ${delta > 0 ? "bg-[var(--m-accent)] text-white" : "bg-[var(--m-ground)] text-[var(--m-ink)]"}`} aria-label={`${delta > 0 ? "up" : "down"} ${Math.abs(delta)}`}>{delta > 0 ? "+" : "−"}{Math.abs(delta)}</span>}
    </span>
  );
}
