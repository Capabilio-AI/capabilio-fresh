"use client";

import { useState } from "react";
import { ArrowRight, Clock } from "lucide-react";
import { ChallengeSolvePanel, type ChallengeDetail } from "./ChallengeSolvePanel";

export interface TrackState {
  scopeKey: string | null;
  scopeLabel: string | null;
  challenges: (ChallengeDetail & { solved: boolean })[];
  nextChallengeId: string | null;
}

const DIFFICULTY_TEXT_CLASS: Record<string, string> = {
  easy: "text-app-success",
  medium: "text-app-warning",
  hard: "text-app-attention",
};
const POINTS_BY_DIFFICULTY: Record<string, number> = { easy: 50, medium: 70, hard: 100 };
const TRACK_ACCENT: Record<"stream" | "domain", { header: string; cta: string; icon: string; title: string }> = {
  stream: { header: "bg-app-success-container", cta: "bg-app-success", icon: "🎓", title: "College Workspace" },
  domain: { header: "bg-app-blue-container", cta: "bg-app-blue", icon: "🏢", title: "Professional Workspace" },
};

export function TrackWorkspaceView({ track, state, emptyHint, onRefresh }: { track: "stream" | "domain"; state: TrackState; emptyHint: string; onRefresh: () => void }) {
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
        track={track}
        challenge={openChallenge}
        onDone={() => {
          setOpenChallenge(null);
          onRefresh();
        }}
      />
    );
  }

  const accent = TRACK_ACCENT[track];
  const nextChallenge = state.challenges.find((c) => c.id === state.nextChallengeId);
  const allSolved = state.challenges.length > 0 && state.challenges.every((c) => c.solved);

  return (
    <div>
      {nextChallenge && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-app-border bg-white shadow-sm">
          <div className={`flex items-center gap-2.5 px-5 py-3.5 ${accent.header}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 text-[15px]">{accent.icon}</span>
            <span className="flex-1 font-lp-mono text-[11px] font-bold uppercase tracking-wide text-app-charcoal">{accent.title}</span>
            {nextChallenge.time_limit_minutes && (
              <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 font-lp-mono text-[10.5px] font-semibold text-app-charcoal">
                <Clock size={11} />
                {nextChallenge.time_limit_minutes} min
              </span>
            )}
          </div>
          <div className="p-5">
            <Field label={track === "stream" ? "Stream" : "Role"} value={state.scopeLabel} />
            <Field label="Next Challenge" value={nextChallenge.title} />
            <Field label="Difficulty" value={nextChallenge.difficulty} />
            <Field label="Reward" value={`+${POINTS_BY_DIFFICULTY[nextChallenge.difficulty] ?? 50} Pts`} />
            <button
              type="button"
              onClick={() => setOpenChallenge(nextChallenge)}
              className={`mt-4 flex items-center gap-1.5 rounded-lg px-4 py-2.5 font-lp-body text-[13px] font-semibold text-white ${accent.cta}`}
            >
              Continue Challenge
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {allSolved && (
        <p className="mb-6 font-lp-body text-[13px] font-semibold text-app-success">All {state.scopeLabel} challenges completed — nice work.</p>
      )}

      <p className="mb-3 font-lp-mono text-[10.5px] font-semibold uppercase tracking-wide text-app-muted">{state.scopeLabel} Problems</p>
      <p className="mb-4 font-lp-body text-[12px] text-app-muted">Pick any challenge below. Once passed it locks — no resubmitting a completed one.</p>

      {state.challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
          <p className="font-lp-body text-[13.5px] text-app-muted">No challenges available yet — try refreshing shortly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.challenges.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenChallenge(c)}
              disabled={c.solved}
              className={`flex flex-col gap-2 rounded-xl border border-app-border bg-white p-4 text-left ${c.solved ? "opacity-60" : "hover:-translate-y-0.5 hover:border-app-charcoal/30 hover:shadow-md"} transition-all`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-lp-mono text-[10.5px] font-semibold uppercase ${DIFFICULTY_TEXT_CLASS[c.difficulty] ?? "text-app-charcoal"}`}>{c.difficulty}</span>
                <span className="rounded-full bg-app-background px-2 py-0.5 font-lp-mono text-[10.5px] font-semibold text-app-charcoal">+{POINTS_BY_DIFFICULTY[c.difficulty] ?? 50}</span>
              </div>
              <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">{c.title}</p>
              <p className="font-lp-body text-[12px] text-app-muted">{c.category}</p>
              <span className="mt-1 font-lp-body text-[12px] font-semibold text-app-charcoal">{c.solved ? "Solved" : "Solve Task →"}</span>
            </button>
          ))}
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
