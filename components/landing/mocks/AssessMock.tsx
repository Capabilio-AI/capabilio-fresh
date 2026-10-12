"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import Window from "./Window";

type Q = { prompt: string; options: string[]; correct: number; skill: string };

const BANK: Record<"career" | "general", Q> = {
  career: {
    skill: "SQL",
    prompt: "Table orders(id, user_id, total). Which query lists users with more than three orders?",
    options: [
      "SELECT user_id FROM orders WHERE COUNT(*) > 3",
      "SELECT user_id FROM orders GROUP BY user_id HAVING COUNT(*) > 3",
      "SELECT user_id FROM orders ORDER BY COUNT(*) > 3",
      "SELECT DISTINCT user_id FROM orders LIMIT 3",
    ],
    correct: 1,
  },
  general: {
    skill: "Logical reasoning",
    prompt: "Every report is reviewed. Some reviewed items are archived. Which statement must be true?",
    options: [
      "Some reports are archived",
      "Every archived item is a report",
      "Every report is reviewed",
      "No archived item is reviewed",
    ],
    correct: 2,
  },
};

export default function AssessMock() {
  const [layer, setLayer] = useState<"career" | "general">("career");
  const [picked, setPicked] = useState<number | null>(null);
  const q = BANK[layer];
  const ok = picked === q.correct;

  const switchLayer = (l: "career" | "general") => {
    setLayer(l);
    setPicked(null);
  };

  return (
    <Window title="Assessment">
      <div className="p-4 sm:p-5">
        <div role="tablist" aria-label="Assessment layer" className="inline-flex rounded-full bg-cap-mist p-1">
          {(["career", "general"] as const).map((l) => (
            <button
              key={l}
              role="tab"
              aria-selected={layer === l}
              onClick={() => switchLayer(l)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                layer === l ? "bg-white text-cap-ink shadow-sm" : "text-cap-muted hover:text-cap-ink"
              }`}
            >
              {l === "career" ? "Career layer" : "General layer"}
            </button>
          ))}
        </div>

        <p className="mt-5 font-cap-display text-lg font-medium leading-snug">{q.prompt}</p>
        <div className="mt-4 grid gap-2">
          {q.options.map((o, i) => {
            const chosen = picked === i;
            const reveal = picked !== null;
            return (
              <button
                key={o}
                disabled={reveal}
                onClick={() => setPicked(i)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left font-mono text-[13px] transition-colors ${
                  chosen
                    ? ok
                      ? "border-cap-ok! bg-[#e4f6ec]"
                      : "border-cap-warn! bg-[#fdf0e0]"
                    : "border-cap-line! hover:border-cap-indigo! hover:bg-cap-indigo-soft/50 disabled:hover:border-cap-line! disabled:hover:bg-transparent"
                } ${reveal && !chosen ? "opacity-55" : ""}`}
              >
                <span>{o}</span>
                {chosen && (ok ? <Check size={18} className="shrink-0 text-cap-ok" /> : <X size={18} className="shrink-0 text-cap-warn" />)}
              </button>
            );
          })}
        </div>

        <div className="mt-4 min-h-[4.5rem] rounded-xl bg-cap-mist p-4 text-sm" aria-live="polite">
          {picked === null ? (
            <span className="text-cap-muted">Pick an answer. The answer key stays on the server and never reaches your browser.</span>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{ok ? "Recorded as correct" : "Recorded as incorrect"}</div>
                <div className="text-cap-muted">
                  {q.skill} moves from Not assessed to Measured. Rating {ok ? "+4" : "−2"}.
                </div>
              </div>
              <button onClick={() => setPicked(null)} className="rounded-full border border-cap-ink/25! px-4 py-1.5 font-semibold hover:bg-white">
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </Window>
  );
}
