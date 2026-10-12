"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import Window from "./Window";

const NOTES = [
  ["Covered", "Both joins return matching rows."],
  ["Missing", "What happens to unmatched rows on the left side."],
  ["Try", "Add a one-line example with NULL results."],
];

export default function InterviewMock() {
  const [done, setDone] = useState(false);
  return (
    <Window title="Interview practice">
      <div className="p-4 sm:p-5">
        <div className="text-xs font-medium text-cap-muted">Question 2 of 5 · SQL</div>
        <p className="mt-1.5 font-cap-display text-xl font-medium leading-snug">Explain the difference between INNER JOIN and LEFT JOIN.</p>
        <div className="mt-4 rounded-xl border border-cap-line! bg-cap-mist p-4 text-sm leading-relaxed text-cap-ink/85">
          An INNER JOIN keeps rows that match on both sides. A LEFT JOIN keeps every row from the left table…
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => setDone(true)}
            disabled={done}
            className="inline-flex items-center gap-2 rounded-full bg-cap-ink px-5 py-2.5 text-sm font-semibold text-cap-paper disabled:opacity-50"
          >
            <Mic size={15} /> Submit answer
          </button>
          {done && (
            <button onClick={() => setDone(false)} className="text-sm font-semibold text-cap-indigo underline">
              Try again
            </button>
          )}
        </div>
        {done && (
          <ul className="mt-4 grid gap-2" aria-live="polite">
            {NOTES.map(([k, v]) => (
              <li key={k} className="flex gap-3 rounded-lg border border-cap-line! px-3 py-2.5 text-sm">
                <span className="w-16 shrink-0 font-semibold">{k}</span>
                {v}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Window>
  );
}
