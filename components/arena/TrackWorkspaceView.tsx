"use client";

import { useState } from "react";
import { ArrowRight, Clock } from "lucide-react";
import { ChallengeSolvePanel, type ChallengeDetail } from "./ChallengeSolvePanel";
import { pointsForDifficulty } from "@/lib/arena-challenges/points";

export interface TrackState {
  scopeKey: string | null;
  scopeLabel: string | null;
  challenges: (ChallengeDetail & { solved: boolean })[];
  nextChallengeId: string | null;
}

const CARD_PALETTE = [
  { bg: "bg-app-orange-container", accent: "text-app-orange" },
  { bg: "bg-app-success-container", accent: "text-app-success" },
  { bg: "bg-app-blue-container", accent: "text-app-blue" },
  { bg: "bg-app-rose-container", accent: "text-app-rose" },
  { bg: "bg-app-purple-container", accent: "text-app-purple" },
];

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

  const nextChallenge = state.challenges.find((c) => c.id === state.nextChallengeId);
  const allSolved = state.challenges.length > 0 && state.challenges.every((c) => c.solved);

  return (
    <div>
      {nextChallenge && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-app-border bg-white shadow-sm">
          <div className="flex items-center gap-2.5 bg-app-success-container px-5 py-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 text-[15px]">🎓</span>
            <span className="flex-1 font-lp-mono text-[11px] font-bold uppercase tracking-wide text-app-charcoal">Stream Workspace</span>
            {nextChallenge.time_limit_minutes && (
              <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 font-lp-mono text-[10.5px] font-semibold text-app-charcoal">
                <Clock size={11} />
                {nextChallenge.time_limit_minutes} min
              </span>
            )}
          </div>
          <div className="p-5">
            <Field label="Stream" value={state.scopeLabel} />
            <Field label="Next Challenge" value={nextChallenge.title} />
            <Field label="Difficulty" value={nextChallenge.difficulty} />
            <Field label="Reward" value={`+${pointsForDifficulty(nextChallenge.difficulty)} Pts`} />
            <button
              type="button"
              onClick={() => setOpenChallenge(nextChallenge)}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-app-success px-4 py-2.5 font-lp-body text-[13px] font-semibold text-white"
            >
              Continue Challenge
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {allSolved && <p className="mb-6 font-lp-body text-[13px] font-semibold text-app-success">All {state.scopeLabel} challenges completed — nice work.</p>}

      <p className="mb-3 font-lp-mono text-[10.5px] font-semibold uppercase tracking-wide text-app-muted">{state.scopeLabel} Problems</p>
      <p className="mb-4 font-lp-body text-[12px] text-app-muted">Pick any challenge below. Once passed it locks — no resubmitting a completed one.</p>

      {state.challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
          <p className="font-lp-body text-[13.5px] text-app-muted">No challenges available yet — try refreshing shortly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.challenges.map((c, i) => {
            const palette = CARD_PALETTE[i % CARD_PALETTE.length];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenChallenge(c)}
                disabled={c.solved}
                className={`flex flex-col gap-3 rounded-2xl p-5 text-left transition-all ${palette.bg} ${c.solved ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-lg"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-lp-mono text-[11px] font-bold uppercase tracking-wide ${palette.accent}`}>{`>_ ${c.difficulty}`}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-lp-mono text-[10.5px] font-bold text-app-charcoal shadow-sm">+{pointsForDifficulty(c.difficulty)} Pts</span>
                </div>
                <p className="font-lp-display text-[16px] font-bold leading-snug text-app-charcoal">{c.title}</p>
                <p className="line-clamp-2 font-lp-body text-[12.5px] leading-relaxed text-app-charcoal/70">{c.objective}</p>
                <span className={`mt-1 font-lp-body text-[12.5px] font-bold ${palette.accent}`}>{c.solved ? "Solved ✓" : "Solve Task →"}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between border-b border-app-border py-1.5 font-lp-body text-[12.5px]">
      <span className="text-app-muted">{label}</span>
      <span className="font-semibold capitalize text-app-charcoal">{value}</span>
    </div>
  );
}
