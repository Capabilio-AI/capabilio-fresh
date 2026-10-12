"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EVENTS = [
  ["Student", "Joins ticket checked", "+4"],
  ["Student", "Statistics diagnostic taken", "measured"],
  ["Organisation", "Semester 6 calendar published", "set by college"],
  ["Verifier", "Skill Passport checked", "valid"],
  ["Student", "Code DNA scan finished", "3 signals"],
  ["Mentor", "Gap summary written", "Statistics"],
  ["Student", "Arena ticket missed", "−2"],
  ["Organisation", "Cohort view opened", "read only"],
] as const;

type Row = { id: number; e: (typeof EVENTS)[number] };

export default function ProofStream() {
  const [rows, setRows] = useState<Row[]>(() => EVENTS.slice(0, 4).map((e, i) => ({ id: i, e })));

  const next = useRef(4);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      const n = next.current;
      next.current = n + 1;
      setRows((r) => [{ id: n, e: EVENTS[n % EVENTS.length] }, ...r].slice(0, 5));
    }, 1800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="mt-8 min-w-0 rounded-2xl border border-white/15! bg-white/[0.05] p-4 font-mono text-xs">
      <div className="mb-3 flex items-center justify-between text-white/60">
        <span className="flex items-center gap-2">
          <span className="cap-pulse h-2 w-2 rounded-full bg-[#4ade80]" />
          proof stream
        </span>
        <span>sample events</span>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5" aria-live="off">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-white/[0.06] px-3 py-2 text-white/85"
            >
              <span className="w-20 shrink-0 text-cap-apricot sm:w-24">{r.e[0]}</span>
              <span className="min-w-0 flex-1 truncate">{r.e[1]}</span>
              <span className="shrink-0 text-white/60">{r.e[2]}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
