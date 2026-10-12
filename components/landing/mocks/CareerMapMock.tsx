"use client";

import { useState } from "react";
import { StateGlyph, STATE_LABEL, type NodeState } from "../StateGlyph";
import Window from "./Window";

type Station = { id: string; name: string; x: number; y: number; state: NodeState; line: "a" | "b"; note: string };

const STATIONS: Station[] = [
  { id: "py", name: "Python", x: 80, y: 90, state: "met", line: "a", note: "Cleared at the role target. Two projects with tests back it." },
  { id: "sql", name: "SQL", x: 200, y: 90, state: "learning", line: "a", note: "Three of five items correct. Finish the joins ticket to move on." },
  { id: "eda", name: "EDA", x: 320, y: 90, state: "met", line: "a", note: "Notebook reviewed, repository has CI." },
  { id: "st", name: "Statistics", x: 440, y: 90, state: "none", line: "a", note: "Nothing measured yet. Shown as not assessed, never as zero." },
  { id: "dash", name: "Dashboards", x: 540, y: 90, state: "locked", line: "a", note: "Locked until Statistics has a result." },
  { id: "git", name: "Git", x: 300, y: 150, state: "check", line: "b", note: "Self-score is high but no commits back it. Check this score." },
  { id: "test", name: "Testing", x: 420, y: 150, state: "none", line: "b", note: "Not assessed." },
  { id: "dep", name: "Deploy", x: 540, y: 150, state: "locked", line: "b", note: "Locked until Testing has a result." },
];

const LEGEND: NodeState[] = ["met", "learning", "none", "check", "locked"];

export default function CareerMapMock() {
  const [sel, setSel] = useState("sql");
  const cur = STATIONS.find((s) => s.id === sel) ?? STATIONS[1];

  return (
    <Window title="Data Analyst · Career map">
      <div className="p-4 sm:p-5">
        <div className="relative -mx-1 overflow-x-auto px-1 [mask-image:linear-gradient(90deg,#000_88%,transparent)] sm:[mask-image:none]">
        <svg viewBox="0 0 600 190" className="w-full min-w-[34rem]" role="group" aria-label="Career map stations">
          <path d="M30 90 H575" stroke="#4a58f0" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M200 90 L260 150 H575" stroke="#e8590c" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <g transform="translate(200 22)">
            <rect x="-38" y="-14" width="76" height="26" rx="13" fill="#0c1020" />
            <text y="4" textAnchor="middle" fontSize="12" fontWeight="600" fill="#fcfcfb">Next stop</text>
            <path d="M0 12v12" stroke="#0c1020" strokeWidth="2" />
          </g>
          {STATIONS.map((s) => (
            <g
              key={s.id}
              role="button"
              tabIndex={0}
              aria-label={`${s.name}: ${STATE_LABEL[s.state]}`}
              aria-pressed={sel === s.id}
              onClick={() => setSel(s.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel(s.id)}
              className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-cap-indigo"
            >
              <circle cx={s.x} cy={s.y} r="20" fill={sel === s.id ? "#e9ebff" : "transparent"} stroke="transparent" strokeWidth="3" />
              <circle cx={s.x} cy={s.y} r="14" fill="#fff" />
              <g transform={`translate(${s.x - 12} ${s.y - 12})`}>
                <StateGlyph state={s.state} size={24} ink="#0c1020" />
              </g>
              <text
                x={s.x}
                y={s.line === "a" ? s.y - 26 : s.y + 36}
                textAnchor="middle"
                fontSize="13"
                fontWeight={sel === s.id ? 700 : 500}
                fill="#0c1020"
              >
                {s.name}
              </text>
            </g>
          ))}
        </svg>
        </div>

        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-cap-muted">
          {LEGEND.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <StateGlyph state={k} size={14} ink="#0c1020" />
              {STATE_LABEL[k]}
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-xl border border-cap-line! bg-cap-mist p-4" aria-live="polite">
          <div className="flex items-center gap-2">
            <StateGlyph state={cur.state} size={18} ink="#0c1020" />
            <span className="font-cap-display text-lg font-semibold">{cur.name}</span>
            <span className="text-sm text-cap-muted">{STATE_LABEL[cur.state]}</span>
          </div>
          <p className="mt-1.5 text-sm text-cap-ink/80">{cur.note}</p>
        </div>
      </div>
    </Window>
  );
}
