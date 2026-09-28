"use client";

import { useEffect, useState } from "react";
import { Flame, Loader2, Target, Trophy } from "lucide-react";

interface Entry {
  userId: string;
  name: string | null;
  branch: string | null;
  points: number;
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

export function ChallengeLeaderboard() {
  const [scope, setScope] = useState<"global" | "branch">("global");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [viewerBranch, setViewerBranch] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/arena/challenges/leaderboard?scope=${scope}`)
      .then((res) => res.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setViewerBranch(data.viewerBranch ?? null);
      })
      .catch(() => setEntries([]));
  }, [scope]);

  function selectScope(next: "global" | "branch") {
    // Reset happens here (an event handler), not at the top of the effect
    // above -- a synchronous setState as the first line of an effect body
    // triggers react-hooks/set-state-in-effect's cascading-render warning.
    setEntries(null);
    setScope(next);
  }

  return (
    <div>
      <div className="text-center">
        <Trophy size={28} className="mx-auto text-app-orange" />
        <h2 className="mt-2 font-lp-display text-[22px] font-bold text-app-charcoal">Challenge Leaderboard</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">Complete weekly challenges to climb the ranks.</p>
      </div>

      <div className="mx-auto mt-5 flex w-fit gap-1 rounded-lg border border-app-border bg-white p-1">
        <button
          type="button"
          onClick={() => selectScope("global")}
          className={`rounded-md px-4 py-1.5 font-lp-body text-[12.5px] font-semibold ${scope === "global" ? "bg-app-charcoal text-white" : "text-app-muted"}`}
        >
          Global Rank
        </button>
        <button
          type="button"
          onClick={() => selectScope("branch")}
          className={`rounded-md px-4 py-1.5 font-lp-body text-[12.5px] font-semibold ${scope === "branch" ? "bg-app-charcoal text-white" : "text-app-muted"}`}
        >
          My Branch{viewerBranch ? ` (${viewerBranch})` : ""}
        </button>
      </div>

      {!entries ? (
        <div className="mt-10 flex justify-center">
          <Loader2 size={20} className="animate-spin text-app-muted" />
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-10 text-center font-lp-body text-[13px] text-app-muted">No rankings yet — be the first to complete a challenge.</p>
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
                    <span className="font-lp-body text-[13px] font-medium text-app-charcoal">
                      {e.isViewer ? "You" : (e.name ?? "Student")}
                    </span>
                    {e.branch && <span className="ml-1.5 rounded-full bg-app-background px-1.5 py-0.5 font-lp-mono text-[9.5px] text-app-muted">{e.branch}</span>}
                    <p className="flex items-center gap-2 font-lp-mono text-[10.5px] text-app-muted">
                      <span className="flex items-center gap-0.5"><Target size={10} />{e.tasksCompleted} Tasks</span>
                      {e.streak > 0 && <span className="flex items-center gap-0.5"><Flame size={10} />{e.streak} Streak</span>}
                    </p>
                  </div>
                </div>
                <span className="font-lp-display text-[16px] font-bold text-app-orange">{e.points} pts</span>
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
      {entry.branch && <span className="rounded-full bg-app-background px-2 py-0.5 font-lp-mono text-[9.5px] text-app-muted">{entry.branch}</span>}
      <span className="font-lp-display text-[18px] font-bold text-app-orange">{entry.points} pts</span>
    </div>
  );
}
