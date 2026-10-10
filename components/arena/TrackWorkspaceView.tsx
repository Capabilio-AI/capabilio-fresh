"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock, Lock } from "lucide-react";
import { ChallengeSolvePanel, type ChallengeDetail } from "./ChallengeSolvePanel";
import { LeetcodeScreen } from "./LeetcodeScreen";
import { pointsForDifficulty } from "@/lib/arena-challenges/points";

export interface TrackState {
  scopeKey: string | null;
  scopeLabel: string | null;
  /** this week's wheel has not been spun and scratched yet */
  needsSpin?: boolean;
  /** this week's problems are still being written; the board polls until they exist */
  preparing?: boolean;
  /** how many of this week's wheel number could not be filled from published content */
  shortfall?: number;
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
  const router = useRouter();
  const [openChallenge, setOpenChallenge] = useState<ChallengeDetail | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // Ticket-style challenges run in a workstation on their own page; classic code/numeric ones open in the panel below.
  async function open(c: ChallengeDetail) {
    if (!c.workstation_template_id) return setOpenChallenge(c);
    setStartError(null);
    const res = await fetch("/api/arena/challenge-attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: c.id }) });
    const body = await res.json().catch(() => ({}));
    if (res.ok) router.push(`/arena/challenges/attempt/${body.attemptId}`);
    else setStartError(body.error ?? "Could not start this challenge.");
  }

  if (state.preparing) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--m-rule)] bg-white px-6 py-14 text-center">
        <p className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Your challenges are being prepared</p>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">This week&apos;s problems are written fresh every Sunday. It takes a few minutes. This page updates by itself.</p>
      </div>
    );
  }

  if (!state.scopeKey) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--m-rule)] bg-white px-6 py-14 text-center">
        <p className="font-lp-body text-[13.5px] text-app-muted">{emptyHint}</p>
      </div>
    );
  }

  if (openChallenge?.kind === "leetcode" && openChallenge.problem) {
    return <LeetcodeScreen challenge={openChallenge} problem={openChallenge.problem} onDone={() => { setOpenChallenge(null); onRefresh(); }} />;
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
        <h2 className="font-lp-display text-[28px] font-bold text-[var(--m-ink)]">Stream Challenges</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">{state.scopeLabel}</p>
      </div>

      {state.challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--m-rule)] bg-white px-6 py-14 text-center">
          <p className="font-lp-body text-[13.5px] text-[var(--m-ink)]">No challenges configured yet for {state.scopeLabel}.</p>
          <p className="mt-1 font-lp-body text-[13px] text-app-muted">New ones are added after review. Meanwhile you can try the Domain track.</p>
          <Link href="/arena/challenges/domain" className="mt-4 inline-block font-lp-body text-[13px] font-semibold text-app-orange hover:underline">
            Browse Domain challenges
          </Link>
        </div>
      ) : (
        <>
          {startError && <p role="alert" className="mb-4 text-center font-lp-body text-[13px] text-app-rose">{startError}</p>}
          {(state.shortfall ?? 0) > 0 && (
            <p className="mb-4 rounded-lg border border-[var(--m-rule)] bg-white px-4 py-2.5 text-center font-lp-body text-[12.5px] text-app-muted">
              Only {state.challenges.length} challenge{state.challenges.length === 1 ? " is" : "s are"} published for {state.scopeLabel} so far — more are added after review.
            </p>
          )}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {state.challenges.map((c, i) => {
            const palette = CARD_PALETTE[i % CARD_PALETTE.length];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => open(c)}
                disabled={c.solved}
                className={`group relative flex min-h-[220px] flex-col rounded-3xl p-7 text-left transition-all duration-200 ${palette.bg} ${
                  c.solved ? "cursor-default" : "hover:-translate-y-1 hover:shadow-[0_16px_36px_-18px_rgba(0,0,0,0.3)]"
                }`}
              >
                {c.solved && (
                  <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-app-success text-white shadow-sm">
                    <Check size={16} strokeWidth={3} />
                  </span>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-lp-mono text-[12px] font-bold uppercase tracking-wide ${palette.accent}`}>{`>_ ${c.difficulty}`}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 font-lp-mono text-[11px] font-semibold text-[var(--m-ink)]/70">
                      <Clock size={11} />
                      {c.time_limit_minutes}m
                    </span>
                    <span className={`rounded-full bg-white px-3 py-1 font-lp-body text-[12px] font-bold ${palette.accent}`}>+{pointsForDifficulty(c.difficulty)} Pts</span>
                  </div>
                </div>
                <p className="mt-6 font-lp-display text-[20px] font-bold leading-snug text-[var(--m-ink)]">{c.title}</p>
                <p className="mt-2 font-lp-body text-[13.5px] leading-relaxed text-[var(--m-ink)]/65">{WORKSPACE_HINT[c.kind] ?? WORKSPACE_HINT.code}</p>
                <span className={`mt-auto flex items-center gap-1.5 pt-6 font-lp-body text-[14px] font-bold ${c.solved ? "text-app-success" : palette.accent}`}>
                  {c.solved ? (
                    <>
                      <Lock size={13} />
                      Completed — locked
                    </>
                  ) : (
                    <>
                      Solve Task
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
