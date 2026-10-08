"use client";

import { useEffect, useState } from "react";
import { Flame, Target, Trophy } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";

interface Stats {
  points: number;
  tasksCompleted: number;
  currentStreak: number;
  longestStreak: number;
}

const TRACK_LABEL = { stream: "Stream", domain: "Domain" } as const;
const POINTS_LABEL = { stream: "pts", domain: "ELO" } as const;

/** Own-track streak card — arena_stream_stats and arena_domain_stats are separate rows, so a Stream streak never moves from Domain work or vice versa. */
export function ChallengeStreak({ track }: { track: "stream" | "domain" }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch(`/api/arena/stats?track=${track}`)
      .then((res) => res.json())
      .then(setStats)
      .catch(() => setStats({ points: 0, tasksCompleted: 0, currentStreak: 0, longestStreak: 0 }));
  }, [track]);

  if (!stats) {
    return (
      <div className="flex justify-center py-16">
        <ThinkingOrb state="searching" size={64} theme="light" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center">
        <Flame size={28} className="mx-auto text-app-orange" />
        <h2 className="mt-2 font-lp-display text-[22px] font-bold text-[var(--m-ink)]">{TRACK_LABEL[track]} Streak</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">One completed challenge per week keeps it alive.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--m-rule)] bg-white p-5 text-center">
          <Flame size={18} className="mx-auto text-app-orange" />
          <p className="mt-2 font-lp-display text-[28px] font-bold text-[var(--m-ink)]">{stats.currentStreak}</p>
          <p className="font-lp-mono text-[10.5px] text-app-muted">Current streak</p>
        </div>
        <div className="rounded-xl border border-[var(--m-rule)] bg-white p-5 text-center">
          <Trophy size={18} className="mx-auto text-app-orange" />
          <p className="mt-2 font-lp-display text-[28px] font-bold text-[var(--m-ink)]">{stats.longestStreak}</p>
          <p className="font-lp-mono text-[10.5px] text-app-muted">Longest streak</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--m-rule)] bg-white px-5 py-3">
        <span className="flex items-center gap-1.5 font-lp-body text-[13px] text-[var(--m-ink)]">
          <Target size={14} className="text-app-muted" />
          {stats.tasksCompleted} completed
        </span>
        <span className="font-lp-mono text-[12.5px] font-semibold text-[var(--m-ink)]">
          {stats.points} {POINTS_LABEL[track]}
        </span>
      </div>
    </div>
  );
}
