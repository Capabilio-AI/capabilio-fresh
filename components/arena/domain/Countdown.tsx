"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** Ticks down to a server-provided time; calls onDone (keep it stable) when it reaches zero. */
export function Countdown({ target, onDone }: { target: string; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Date.parse(target) - now);
  const done = remaining === 0;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  const s = Math.floor(remaining / 1000);
  return (
    <span className="font-lp-mono tabular-nums">
      {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
    </span>
  );
}
