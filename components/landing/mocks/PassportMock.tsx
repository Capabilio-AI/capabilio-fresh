"use client";

import { useRef, useState } from "react";
import { BadgeCheck, ChevronDown, Mic } from "lucide-react";
import Window from "./Window";

const WAVE = [5, 9, 14, 8, 17, 11, 6, 15, 10, 18, 7, 12, 16, 9, 5, 13, 8, 11, 6, 10];
const ITEMS = [
  { id: "sql", title: "SQL · joins ticket", elo: "+4", given: "Orders page times out for large accounts", written: "Added an index on user_id and selected only needed columns", expected: "Under 200 ms on 100k rows", actual: "148 ms" },
  { id: "eda", title: "Exploratory analysis notebook", elo: "+4", given: "Sales export with missing regions", written: "Cleaning steps and three charts with notes", expected: "Missing values handled, charts labelled", actual: "Reviewed and accepted" },
];

export default function PassportMock() {
  const [open, setOpen] = useState<string | null>("sql");
  const card = useRef<HTMLDivElement>(null);
  const tilt = (e: React.PointerEvent) => {
    const el = card.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${(-y * 10).toFixed(1)}deg) rotateY(${(x * 12).toFixed(1)}deg)`;
  };
  return (
    <Window title="Skill Passport">
      <div className="p-4 sm:p-5">
        <div
          ref={card}
          onPointerMove={tilt}
          onPointerLeave={() => card.current && (card.current.style.transform = "")}
          className="relative overflow-hidden rounded-xl bg-cap-night p-5 text-white transition-transform duration-150 ease-out"
        >
          <svg aria-hidden="true" viewBox="0 0 300 80" className="pointer-events-none absolute inset-x-0 bottom-0 w-full opacity-60">
            <path d="M0 80V55l40-14 36 16 44-30 40 22 50-34 48 28 42-18v55z" fill="#1b2150" />
            <path d="M0 80V66l50-10 46 12 52-20 56 18 48-14 48 10v18z" fill="#4a58f0" opacity="0.5" />
          </svg>
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="font-cap-display text-2xl font-semibold">Sample student</div>
              <div className="mt-0.5 text-sm text-white/70">Data Analyst track</div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold">
              <span className="cap-pulse h-2 w-2 rounded-full bg-[#4ade80]" />
              Verifiable
            </span>
          </div>
          <div className="relative mt-6 font-mono text-xs tracking-wider text-white/70">CAP-SAMPLE-0000</div>
        </div>

        <ul className="mt-4 grid gap-2">
          {ITEMS.map((it) => {
            const isOpen = open === it.id;
            return (
              <li key={it.id} className="rounded-xl border border-cap-line!">
                <button
                  onClick={() => setOpen(isOpen ? null : it.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <BadgeCheck size={18} className="text-cap-indigo" />
                  <span className="flex-1 text-sm font-semibold">{it.title}</span>
                  <span className="text-sm font-semibold text-cap-ok">{it.elo}</span>
                  <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <dl className="grid gap-2 border-t border-cap-line! px-4 py-3 text-[13px] sm:grid-cols-2">
                    {[
                      ["Given", it.given],
                      ["Written", it.written],
                      ["Expected", it.expected],
                      ["Actual", it.actual],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs font-medium text-cap-muted">{k}</dt>
                        <dd className="text-cap-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-3 flex items-center gap-3 rounded-xl bg-cap-mist px-4 py-3">
          <Mic size={16} className="text-cap-indigo" />
          <div className="cap-wave flex h-5 flex-1 items-end gap-[3px]" aria-hidden="true">
            {WAVE.map((h, i) => (
              <span key={i} className="w-full rounded-full bg-cap-indigo" style={{ height: h, animationDelay: `${i * 70}ms` }} />
            ))}
          </div>
          <span className="text-xs font-medium text-cap-muted">Proof reel · voiced</span>
        </div>
      </div>
    </Window>
  );
}
