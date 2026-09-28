"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";

interface HistoryWeek {
  id: string;
  track: "stream" | "domain";
  weekStart: string;
  taskCount: number;
  solvedCount: number;
}

const TRACK_LABEL: Record<string, string> = { stream: "Stream", domain: "Domain" };

export function ChallengeHistory() {
  const [weeks, setWeeks] = useState<HistoryWeek[] | null>(null);

  useEffect(() => {
    fetch("/api/arena/challenges/history")
      .then((res) => res.json())
      .then((data) => setWeeks(data.weeks ?? []))
      .catch(() => setWeeks([]));
  }, []);

  return (
    <div>
      <div className="text-center">
        <h2 className="font-lp-display text-[22px] font-bold text-app-charcoal">Challenge History</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">Review your past scratch cards and completed challenges.</p>
      </div>

      {!weeks ? (
        <div className="mt-10 flex justify-center">
          <Loader2 size={20} className="animate-spin text-app-muted" />
        </div>
      ) : weeks.length === 0 ? (
        <div className="mt-6 rounded-xl border border-app-border bg-white px-6 py-16 text-center">
          <Clock size={28} className="mx-auto text-app-attention" />
          <p className="mt-3 font-lp-body text-[13.5px] text-app-muted">No past weeks found. Start scratching your current card!</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {weeks.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-xl border border-app-border bg-white px-5 py-4">
              <div>
                <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">
                  {TRACK_LABEL[w.track]} — Week of {new Date(w.weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <p className="mt-0.5 font-lp-mono text-[11px] text-app-muted">{w.solvedCount} of {w.taskCount} tasks solved</p>
              </div>
              <span className="rounded-full bg-app-background px-3 py-1 font-lp-mono text-[11px] font-semibold text-app-charcoal">
                {Math.round((w.solvedCount / w.taskCount) * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
