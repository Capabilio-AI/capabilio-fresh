"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleX, Clock, Timer } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { EvidenceModal } from "@/components/portfolio/EvidenceModal";
import { useLive } from "@/components/live/useLive";

interface Completion {
  id: string;
  /** the change on the career ELO (the rating on the dashboard and leaderboard) */
  ratingDelta: number;
  /** the career ELO right after this ticket closed */
  ratingAfter: number | null;
  completedAt: string;
  areaName: string;
  /** set on a ticket that closed without a pass: wrong final answer, or time ran out */
  outcome?: "wrong" | "timed_out";
  challenge: { title: string; company: string | null } | null;
}

const SIGN = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const LOOK = {
  solved: { icon: CheckCircle2, node: "bg-app-success text-white", chip: "bg-app-success-container text-app-success", label: "Solved" },
  wrong: { icon: CircleX, node: "bg-app-rose text-white", chip: "bg-app-rose-container text-app-rose", label: "Not solved" },
  timed_out: { icon: Timer, node: "bg-app-rose text-white", chip: "bg-app-rose-container text-app-rose", label: "Time ran out" },
} as const;

/** The ELO after each closed ticket, oldest first, as one line: the story of how the rating moved. */
function Trend({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const span = Math.max(1, Math.max(...points) - min);
  const W = 300, H = 56, PAD = 6;
  const xy = points.map((p, i) => [PAD + (i * (W - 2 * PAD)) / (points.length - 1), H - PAD - ((p - min) / span) * (H - 2 * PAD)] as const);
  const last = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" role="img" aria-label={`ELO over your last ${points.length} tickets: from ${points[0]} to ${points[points.length - 1]}`}>
      <polyline points={xy.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="var(--app-orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill="var(--app-orange)" />
    </svg>
  );
}

/** Domain history: every ticket closed, solved or not, with what it did to the career ELO. A timeline, newest on top. */
export function DomainHistory() {
  const [completions, setCompletions] = useState<Completion[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/arena/domain/history", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setCompletions(data.completions ?? []))
      .catch(() => setCompletions((prev) => prev ?? []));
  }, []);
  useEffect(load, [load]);
  useLive(load);

  const solved = completions?.filter((c) => !c.outcome).length ?? 0;
  const missed = (completions?.length ?? 0) - solved;
  const net = completions?.reduce((sum, c) => sum + c.ratingDelta, 0) ?? 0;
  const trend = (completions ?? []).filter((c) => c.ratingAfter !== null).map((c) => c.ratingAfter as number).reverse();

  return (
    <div>
      <div className="text-center">
        <h2 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Domain History</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">Every ticket you have closed, and what it did to your ELO.</p>
      </div>

      {!completions ? (
        <div className="mt-10 flex justify-center"><ThinkingOrb state="searching" size={64} theme="light" /></div>
      ) : completions.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[var(--m-rule)] bg-white px-6 py-16 text-center">
          <Clock size={28} className="mx-auto text-app-attention" aria-hidden />
          <p className="mt-3 font-lp-body text-[13.5px] text-app-muted">No tickets closed yet. Finish a Domain ticket and its story starts here.</p>
        </div>
      ) : (
        <>
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-[var(--m-rule)] bg-white px-5 py-4">
            <div className="grid grid-cols-3 text-center">
              <div><p className="font-lp-display text-[24px] font-bold text-app-success">{solved}</p><p className="font-lp-mono text-[10.5px] text-app-muted">solved</p></div>
              <div><p className="font-lp-display text-[24px] font-bold text-app-rose">{missed}</p><p className="font-lp-mono text-[10.5px] text-app-muted">missed</p></div>
              <div><p className={`font-lp-display text-[24px] font-bold ${net < 0 ? "text-app-rose" : "text-app-orange"}`}>{SIGN(net)}</p><p className="font-lp-mono text-[10.5px] text-app-muted">net ELO</p></div>
            </div>
            <Trend points={trend} />
          </div>

          <ol className="relative mx-auto mt-6 max-w-xl">
            <span className="absolute bottom-3 left-[17px] top-3 w-px bg-[var(--m-rule)]" aria-hidden />
            {completions.map((c) => {
              const look = LOOK[c.outcome ?? "solved"];
              const Icon = look.icon;
              return (
                <li key={c.id} className="relative flex gap-4 pb-4">
                  <span className={`z-10 mt-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-[var(--app-background)] ${look.node}`}><Icon size={17} aria-hidden /></span>
                  <div className="min-w-0 flex-1 rounded-xl border border-[var(--m-rule)] bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-lp-body text-[13.5px] font-semibold text-[var(--m-ink)]">{c.challenge?.title ?? "Deleted ticket"}</p>
                        <p className="mt-0.5 font-lp-mono text-[11px] text-app-muted">{[c.challenge?.company, c.areaName, dayOf(c.completedAt)].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`font-lp-display text-[20px] font-bold leading-none ${c.ratingDelta < 0 ? "text-app-rose" : c.ratingDelta > 0 ? "text-app-success" : "text-app-muted"}`}>{SIGN(c.ratingDelta)}</p>
                        {c.ratingAfter !== null && <p className="mt-1 font-lp-mono text-[10.5px] text-app-muted">ELO {c.ratingAfter}</p>}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`rounded-full px-2.5 py-0.5 font-lp-mono text-[10.5px] font-semibold ${look.chip}`}>{look.label}</span>
                      {!c.outcome && <button type="button" onClick={() => setOpenId(c.id)} className="font-lp-body text-[12.5px] font-bold text-app-orange hover:underline">View details</button>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {openId && <EvidenceModal fetchUrl={`/api/arena/attempts/${openId}`} onClose={() => setOpenId(null)} />}
    </div>
  );
}
