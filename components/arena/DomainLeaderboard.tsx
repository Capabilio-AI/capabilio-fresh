"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame, Target } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { faceFor } from "@/lib/arena/faces";
import { getTier } from "@/lib/portfolio/elo";
import { useLive } from "@/components/live/useLive";

interface Entry {
  userId: string;
  name: string | null;
  rating: number;
  tasksCompleted: number;
  streak: number;
  rank: number;
  isViewer: boolean;
}

const nameOf = (e: Entry) => (e.isViewer ? "You" : (e.name ?? "Student"));

/** Where the viewer stands, in one sentence: how far behind the next student, or how far ahead of the one behind. */
function standing(entries: Entry[], viewer: Entry): string {
  const above = entries[viewer.rank - 2];
  const below = entries[viewer.rank];
  if (above) return `${above.rating - viewer.rating} ELO behind ${above.name ?? "the next student"}`;
  if (below) return `${viewer.rating - below.rating} ELO clear of ${below.name ?? "second place"}`;
  return "You are the only one ranked so far";
}

/** Domain's own ELO-rank leaderboard: global, one row per student, ranked by the same career ELO the dashboard shows, and live. */
export function DomainLeaderboard() {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  const load = useCallback(() => {
    fetch("/api/arena/domain/leaderboard", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => setEntries((prev) => prev ?? []));
  }, []);
  useEffect(load, [load]);
  useLive(load);

  const viewer = entries?.find((e) => e.isViewer);

  return (
    <div>
      <div className="text-center">
        <h2 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Domain Leaderboard</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">Ranked by career ELO. Solve a ticket and you climb, miss one and you slip. It updates as it happens.</p>
      </div>

      {!entries ? (
        <div className="mt-10 flex justify-center"><ThinkingOrb state="searching" size={64} theme="light" /></div>
      ) : entries.length === 0 ? (
        <p className="mt-10 text-center font-lp-body text-[13px] text-app-muted">No rankings yet. Be the first to close a Domain ticket.</p>
      ) : (
        <>
          {viewer && (
            <div className="mx-auto mt-6 flex max-w-md items-center gap-3 rounded-2xl border border-app-orange/30 bg-app-orange-container/60 px-4 py-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[26px]" aria-hidden>{faceFor(viewer.userId)}</span>
              <div className="min-w-0 flex-1">
                <p className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">You are #{viewer.rank}</p>
                <p className="truncate font-lp-body text-[12.5px] text-app-muted">{standing(entries, viewer)}</p>
              </div>
              <span className="font-lp-display text-[22px] font-bold text-app-orange">{viewer.rating}</span>
            </div>
          )}

          <Podium entries={entries.slice(0, 3)} />

          {entries.length > 3 && (
            <ol className="mt-6 flex flex-col gap-2">
              {entries.slice(3).map((e) => <Row key={e.userId} entry={e} />)}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

const PODIUM = {
  1: { block: "h-28 bg-app-orange-container border-app-orange/40", face: "h-20 w-20 text-[42px] border-2 border-app-orange", order: "order-2" },
  2: { block: "h-20 bg-app-background border-[var(--m-rule)]", face: "h-16 w-16 text-[34px] border border-[var(--m-rule)]", order: "order-1" },
  3: { block: "h-14 bg-app-background border-[var(--m-rule)]", face: "h-16 w-16 text-[34px] border border-[var(--m-rule)]", order: "order-3" },
} as const;

function Podium({ entries }: { entries: Entry[] }) {
  return (
    <div className="mx-auto mt-8 flex max-w-lg items-end justify-center gap-3">
      {entries.map((e) => {
        const look = PODIUM[e.rank as 1 | 2 | 3];
        return (
          <div key={e.userId} className={`flex min-w-0 flex-1 flex-col items-center ${look.order}`}>
            {e.rank === 1 && <span className="text-[22px] leading-none" aria-label="Leader">👑</span>}
            <span className={`mt-1 flex items-center justify-center rounded-full bg-white ${look.face}`} aria-hidden>{faceFor(e.userId)}</span>
            <p className={`mt-2 max-w-full truncate font-lp-body text-[13px] font-semibold ${e.isViewer ? "text-app-orange" : "text-[var(--m-ink)]"}`}>{nameOf(e)}</p>
            <p className="font-lp-mono text-[10.5px] text-app-muted">{getTier(e.rating).label}</p>
            <div className={`mt-2 flex w-full items-start justify-center rounded-t-2xl border border-b-0 pt-2 ${look.block}`}>
              <div className="text-center">
                <p className="font-lp-display text-[20px] font-bold leading-none text-[var(--m-ink)]">{e.rating}</p>
                <p className="mt-0.5 font-lp-mono text-[10px] text-app-muted">#{e.rank} · ELO</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ entry: e }: { entry: Entry }) {
  const tier = getTier(e.rating);
  return (
    <li className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${e.isViewer ? "border-app-orange/40 bg-app-orange-container/50" : "border-[var(--m-rule)] bg-white"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-8 shrink-0 font-lp-mono text-[12px] text-app-muted">#{e.rank}</span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-background text-[22px]" aria-hidden>{faceFor(e.userId)}</span>
        <div className="min-w-0">
          <p className="truncate font-lp-body text-[13.5px] font-semibold text-[var(--m-ink)]">
            {nameOf(e)}
            <span className="ml-2 rounded-full px-2 py-0.5 font-lp-mono text-[10px] font-semibold" style={{ color: tier.color, backgroundColor: `${tier.color}1a` }}>{tier.label}</span>
          </p>
          <p className="flex items-center gap-3 font-lp-mono text-[10.5px] text-app-muted">
            <span className="flex items-center gap-1"><Target size={10} aria-hidden />{e.tasksCompleted} tickets</span>
            {e.streak > 0 && <span className="flex items-center gap-1 text-app-orange"><Flame size={10} aria-hidden />{e.streak} week streak</span>}
          </p>
        </div>
      </div>
      <span className="shrink-0 font-lp-display text-[18px] font-bold text-app-orange">{e.rating}<span className="ml-1 font-lp-mono text-[10px] font-semibold text-app-muted">ELO</span></span>
    </li>
  );
}
