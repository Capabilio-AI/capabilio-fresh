"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { SpinWheel } from "./SpinWheel";
import { ScratchCard } from "./ScratchCard";
import { ChallengeSolvePanel, type ChallengeDetail } from "./ChallengeSolvePanel";

const DIFFICULTY_TEXT_CLASS: Record<string, string> = {
  easy: "text-app-success",
  medium: "text-app-warning",
  hard: "text-app-attention",
};

type WeekState = null | { id: string; status: "spun"; taskCount: number } | { id: string; status: "revealed"; taskCount: number; challenges: ChallengeDetail[] };

export interface TrackState {
  scopeKey: string | null;
  scopeLabel: string | null;
  week: WeekState;
}

const POINTS_BY_DIFFICULTY: Record<string, number> = { easy: 50, medium: 70, hard: 100 };

export function ActiveWeekView({ track, state, emptyHint, onRefresh }: { track: "stream" | "domain"; state: TrackState; emptyHint: string; onRefresh: () => void }) {
  const [openChallenge, setOpenChallenge] = useState<ChallengeDetail | null>(null);
  const [scratchRevealing, setScratchRevealing] = useState(false);

  async function spin() {
    const res = await fetch(`/api/arena/challenges/${track}/spin`, { method: "POST" });
    if (res.ok) onRefresh();
  }

  async function reveal() {
    if (scratchRevealing) return;
    setScratchRevealing(true);
    await fetch(`/api/arena/challenges/${track}/scratch`, { method: "POST" });
    onRefresh();
  }

  if (!state.scopeKey) {
    return (
      <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
        <p className="font-lp-body text-[13.5px] text-app-muted">{emptyHint}</p>
      </div>
    );
  }

  if (openChallenge) {
    return (
      <ChallengeSolvePanel
        track={track}
        challenge={openChallenge}
        onDone={() => {
          setOpenChallenge(null);
          onRefresh();
        }}
      />
    );
  }

  return (
    <div className="rounded-xl border border-app-border bg-gradient-to-b from-app-background to-white p-8">
      <div className="mb-6 text-center">
        <p className="font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-muted">{state.scopeLabel}</p>
        <h2 className="mt-1 font-lp-display text-[22px] font-bold text-app-charcoal">Weekly Challenges</h2>
      </div>

      {!state.week && (
        <div className="flex justify-center">
          <SpinWheel onSpin={spin} />
        </div>
      )}

      {state.week?.status === "spun" && (
        <div className="flex flex-col items-center gap-3">
          <ScratchCard taskCount={state.week.taskCount} onRevealed={reveal} />
          {scratchRevealing && (
            <p className="flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted">
              <Loader2 size={12} className="animate-spin" />
              Unlocking your tasks…
            </p>
          )}
        </div>
      )}

      {state.week?.status === "revealed" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {state.week.challenges.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenChallenge(c)}
              disabled={c.solved}
              className={`flex flex-col gap-2 rounded-xl p-5 text-left ${CARD_BG[i % CARD_BG.length]} ${c.solved ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-md"} transition-all`}
            >
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-1 font-lp-mono text-[10.5px] font-semibold uppercase ${DIFFICULTY_TEXT_CLASS[c.difficulty] ?? "text-app-charcoal"}`}>
                  {`>_ ${c.difficulty}`}
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 font-lp-mono text-[11px] font-semibold text-app-charcoal">+{POINTS_BY_DIFFICULTY[c.difficulty] ?? 50} Pts</span>
              </div>
              <p className="font-lp-display text-[15px] font-semibold text-app-charcoal">{c.title}</p>
              <p className="font-lp-body text-[12.5px] text-app-muted">{c.scenario}</p>
              <span className="mt-1 flex items-center gap-1 font-lp-body text-[12.5px] font-semibold text-app-charcoal">
                {c.solved ? "Solved" : "Solve Task"}
                {!c.solved && <ExternalLink size={12} />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CARD_BG = ["bg-app-attention-container/40", "bg-app-success-container/40", "bg-app-blue-container/40", "bg-app-warning-container/40"];
