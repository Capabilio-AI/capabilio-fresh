"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { ChallengeSolvePanel, type ChallengeDetail } from "./ChallengeSolvePanel";
import { pointsForDifficulty } from "@/lib/arena-challenges/points";

export interface TrackState {
  scopeKey: string | null;
  scopeLabel: string | null;
  challenges: (ChallengeDetail & { solved: boolean })[];
}

const CARD_PALETTE = [
  { bg: "bg-app-orange-container", accent: "text-app-orange" },
  { bg: "bg-app-success-container", accent: "text-app-success" },
  { bg: "bg-app-blue-container", accent: "text-app-blue" },
  { bg: "bg-app-rose-container", accent: "text-app-rose" },
  { bg: "bg-app-purple-container", accent: "text-app-purple" },
];

const WORKSPACE_HINT: Record<string, string> = {
  code: "Write and run your program in the code workspace.",
  numeric: "Work it out and submit your answer in the calculation workspace.",
};

export function TrackWorkspaceView({ state, emptyHint, onRefresh }: { state: TrackState; emptyHint: string; onRefresh: () => void }) {
  const [openChallenge, setOpenChallenge] = useState<ChallengeDetail | null>(null);

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
        challenge={openChallenge}
        onDone={() => {
          setOpenChallenge(null);
          onRefresh();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center">
        <h2 className="font-lp-display text-[28px] font-bold text-app-charcoal">Stream Challenges</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">{state.scopeLabel}</p>
      </div>

      {state.challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
          <p className="font-lp-body text-[13.5px] text-app-muted">No challenges available yet — try refreshing shortly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {state.challenges.map((c, i) => {
            const palette = CARD_PALETTE[i % CARD_PALETTE.length];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenChallenge(c)}
                disabled={c.solved}
                className={`flex min-h-[220px] flex-col rounded-3xl p-7 text-left transition-transform ${palette.bg} ${c.solved ? "opacity-60" : "hover:-translate-y-0.5"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-lp-mono text-[12px] font-bold uppercase tracking-wide ${palette.accent}`}>{`>_ ${c.difficulty}`}</span>
                  <span className={`rounded-full bg-white px-3 py-1 font-lp-body text-[12px] font-bold ${palette.accent}`}>+{pointsForDifficulty(c.difficulty)} Pts</span>
                </div>
                <p className="mt-6 font-lp-display text-[20px] font-bold leading-snug text-app-charcoal">{c.title}</p>
                <p className="mt-2 font-lp-body text-[13.5px] leading-relaxed text-app-charcoal/65">{WORKSPACE_HINT[c.kind] ?? WORKSPACE_HINT.code}</p>
                <span className={`mt-auto flex items-center gap-1 pt-6 font-lp-body text-[14px] font-bold ${palette.accent}`}>
                  {c.solved ? (
                    <>
                      Solved <Check size={15} />
                    </>
                  ) : (
                    <>
                      Solve Task <ArrowRight size={15} />
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
