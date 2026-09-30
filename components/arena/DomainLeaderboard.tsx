"use client";

import { useEffect, useState } from "react";
import { Flame, Target, Trophy } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";

interface Entry {
  userId: string;
  name: string | null;
  rating: number;
  tasksCompleted: number;
  streak: number;
  rank: number;
  isViewer: boolean;
}

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Domain's own ELO-rank leaderboard — global only, no branch scope (career choice isn't a branch). */
export function DomainLeaderboard() {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    fetch("/api/arena/domain/leaderboard")
      .then((res) => res.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => setEntries([]));
  }, []);

  return (
    <div>
      <div className="text-center">
        <Trophy size={28} className="mx-auto text-app-orange" />
        <h2 className="mt-2 font-lp-display text-[22px] font-bold text-app-charcoal">Domain Leaderboard</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">Ranked by verified ELO rating across your career-role work tickets.</p>
      </div>

      {!entries ? (
        <div className="mt-10 flex justify-center">
          <ThinkingOrb state="searching" size={64} theme="light" />
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-10 text-center font-lp-body text-[13px] text-app-muted">No rankings yet — be the first to complete a Domain ticket.</p>
      ) : (
        <div className="mt-8">
          <div className="flex items-end justify-center gap-6">
            {[entries[1], entries[0], entries[2]].filter(Boolean).map((e) => (
              <PodiumEntry key={e!.userId} entry={e!} />
            ))}
          </div>
          <div className="mt-6 flex flex-col divide-y divide-app-border rounded-xl border border-app-border bg-white">
            {entries.slice(3).map((e) => (
              <div key={e.userId} className={`flex items-center justify-between px-4 py-3 ${e.isViewer ? "bg-app-orange-container/40" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="w-8 font-lp-mono text-[12px] text-app-muted">#{e.rank}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-app-background font-lp-mono text-[11px] font-semibold text-app-charcoal">{initialsOf(e.name)}</span>
                  <div>
                    <span className="font-lp-body text-[13px] font-medium text-app-charcoal">{e.isViewer ? "You" : (e.name ?? "Student")}</span>
                    <p className="flex items-center gap-2 font-lp-mono text-[10.5px] text-app-muted">
                      <span className="flex items-center gap-0.5"><Target size={10} />{e.tasksCompleted} Tickets</span>
                      {e.streak > 0 && <span className="flex items-center gap-0.5"><Flame size={10} />{e.streak} Streak</span>}
                    </p>
                  </div>
                </div>
                <span className="font-lp-display text-[16px] font-bold text-app-orange">{e.rating} ELO</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PodiumEntry({ entry }: { entry: Entry }) {
  const isFirst = entry.rank === 1;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={`flex items-center justify-center rounded-full font-lp-mono font-semibold text-app-charcoal ${
          isFirst ? "h-20 w-20 border-2 border-app-orange bg-app-orange-container text-[18px]" : "h-16 w-16 bg-app-background text-[15px]"
        }`}
      >
        {initialsOf(entry.name)}
      </span>
      <p className="font-lp-body text-[13px] font-semibold text-app-charcoal">{entry.isViewer ? "You" : (entry.name ?? "Student")}</p>
      <span className="font-lp-display text-[18px] font-bold text-app-orange">{entry.rating} ELO</span>
    </div>
  );
}
