"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame, Lock, Target, Trophy } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { currentWeekStart, weekStartOf } from "@/lib/arena-challenges/week";
import { useLive } from "@/components/live/useLive";

interface Stats {
  rating: number | null;
  points: number;
  tasksCompleted: number;
  currentStreak: number;
  longestStreak: number;
}

const TRACK_LABEL = { stream: "Stream", domain: "Domain" } as const;
const WEEKS_SHOWN = 8;
const MILESTONES = [3, 5, 10] as const;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The Monday of each of the last WEEKS_SHOWN weeks, oldest first. */
function recentWeeks(): string[] {
  const thisWeek = new Date(`${currentWeekStart()}T00:00:00Z`).getTime();
  return Array.from({ length: WEEKS_SHOWN }, (_, i) => weekStartOf(new Date(thisWeek - (WEEKS_SHOWN - 1 - i) * WEEK_MS)));
}

/** Own-track streak: arena_stream_stats and arena_domain_stats are separate rows, so a Stream streak never moves from Domain work or vice versa. A Domain ticket that closes, solved or not, keeps the week alive. */
export function ChallengeStreak({ track }: { track: "stream" | "domain" }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeWeeks, setActiveWeeks] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    fetch(`/api/arena/stats?track=${track}`, { cache: "no-store" })
      .then((res) => res.json())
      .then(setStats)
      .catch(() => setStats((prev) => prev ?? { rating: null, points: 0, tasksCompleted: 0, currentStreak: 0, longestStreak: 0 }));
    if (track === "domain") {
      fetch("/api/arena/domain/history", { cache: "no-store" })
        .then((res) => res.json())
        .then((data: { completions?: { completedAt: string }[] }) => setActiveWeeks(new Set((data.completions ?? []).map((c) => weekStartOf(new Date(c.completedAt))))))
        .catch(() => undefined);
    }
  }, [track]);
  useEffect(load, [load]);
  useLive(load);

  if (!stats) return <div className="flex justify-center py-16"><ThinkingOrb state="searching" size={64} theme="light" /></div>;

  const weeks = recentWeeks();
  const thisWeek = currentWeekStart();
  const doneThisWeek = activeWeeks.has(thisWeek);
  const best = Math.max(stats.longestStreak, stats.currentStreak);

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-3xl border border-[var(--m-rule)] bg-white px-6 py-8 text-center">
        <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-app-orange-container">
          <Flame size={64} className={stats.currentStreak > 0 ? "text-app-orange" : "text-app-muted"} aria-hidden />
          <span className="absolute -bottom-2 rounded-full bg-[var(--m-ink)] px-3 py-0.5 font-lp-display text-[20px] font-bold text-app-orange-container">{stats.currentStreak}</span>
        </div>
        <h2 className="mt-5 font-lp-display text-[22px] font-bold text-[var(--m-ink)]">{TRACK_LABEL[track]} streak</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">
          {stats.currentStreak === 0 ? "Close a ticket this week to start one." : `${stats.currentStreak} ${stats.currentStreak === 1 ? "week" : "weeks"} in a row. Your best is ${best}.`}
        </p>
        {track === "domain" && (
          <p className={`mx-auto mt-3 inline-block rounded-full px-3 py-1 font-lp-mono text-[11px] font-semibold ${doneThisWeek ? "bg-app-success-container text-app-success" : "bg-app-orange-container text-app-orange"}`}>
            {doneThisWeek ? "This week is safe: a ticket is closed" : "Close a ticket by Sunday to keep it going"}
          </p>
        )}
      </div>

      {track === "domain" && (
        <div className="mt-3 rounded-2xl border border-[var(--m-rule)] bg-white px-5 py-4">
          <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">Last {WEEKS_SHOWN} weeks</p>
          <ol className="mt-3 flex justify-between">
            {weeks.map((w) => {
              const on = activeWeeks.has(w);
              const now = w === thisWeek;
              return (
                <li key={w} className="flex flex-col items-center gap-1.5" aria-label={`Week of ${w}: ${on ? "ticket closed" : "no ticket"}`}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${on ? "bg-app-orange text-white" : now ? "border-2 border-dashed border-app-orange" : "border border-[var(--m-rule)] bg-app-background"}`}>
                    {on && <Flame size={15} aria-hidden />}
                  </span>
                  <span className={`font-lp-mono text-[9.5px] ${now ? "font-semibold text-app-orange" : "text-app-muted"}`}>{now ? "now" : new Date(`${w}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        {MILESTONES.map((m) => {
          const reached = best >= m;
          return (
            <div key={m} className={`rounded-2xl border px-3 py-4 text-center ${reached ? "border-app-orange/40 bg-app-orange-container/60" : "border-[var(--m-rule)] bg-white"}`}>
              {reached ? <Trophy size={18} className="mx-auto text-app-orange" aria-hidden /> : <Lock size={16} className="mx-auto text-app-muted" aria-hidden />}
              <p className="mt-1.5 font-lp-display text-[20px] font-bold text-[var(--m-ink)]">{m}</p>
              <p className="font-lp-mono text-[10px] text-app-muted">{reached ? "weeks reached" : "weeks to unlock"}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl border border-[var(--m-rule)] bg-white px-5 py-3">
        <span className="flex items-center gap-1.5 font-lp-body text-[13px] text-[var(--m-ink)]"><Target size={14} className="text-app-muted" aria-hidden />{stats.tasksCompleted} solved</span>
        <span className="font-lp-mono text-[12.5px] font-semibold text-[var(--m-ink)]">{track === "domain" && stats.rating !== null ? `${stats.rating} ELO` : `${stats.points} pts`}</span>
      </div>
    </div>
  );
}
