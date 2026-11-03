"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { announceArenaChange } from "@/lib/arena-workstations/refresh";
import { ArrowLeft, CheckCircle2, CircleX, Database } from "lucide-react";
import { ELO_BY_DIFFICULTY } from "@/lib/arena-workstations/types";
import { Countdown } from "./Countdown";
import { WorkTimer } from "./WorkTimer";
import { ARENA_TEST_MODE } from "@/lib/arena-workstations/test-mode";
import { ReviewDialog } from "./ReviewDialog";
import { reviewSubmission } from "@/lib/arena-workstations/review";
import { WORKSTATIONS } from "./registry";

export interface PublicAttempt {
  attemptId: string;
  assignedAt: string;
  status: string;
  submissionCount: number;
  /** seconds already worked on this ticket, kept on the account so the clock resumes where it stopped */
  timeSpentSeconds?: number;
  lastGrade: { passed: boolean; message: string; checks: { label: string; passed: boolean }[] } | null;
  area: { key: string | null; name: string | null };
  /** a solved task waits for the user to explain it */
  explain?: { submission: string; checks: string[]; attempts: number; maxAttempts: number } | null;
  challenge: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
    time_limit_minutes: number;
    scenario: string;
    objective: string;
    requester: string | null;
    skill_tags: string[];
    tool_type: string | null;
    content: { company?: string } & Record<string, unknown>;
  };
}

interface Feedback {
  passed: boolean;
  message: string;
  checks: { label: string; passed: boolean }[];
  points?: number;
  nextAvailableAt?: string;
  /** solved; the rating comes after the user explains their work */
  explain?: boolean;
  /** a stage of a Proof Session: passing moves on to the next stage, with no rating yet */
  session?: boolean;
  /** what a wrong answer did to the rating (negative), when it was charged */
  eloChange?: number;
  /** the change on the profile ELO (the rating on the dashboard, portfolio and leaderboard); eloChange is the skill area's */
  careerEloChange?: number;
  /** a wrong submission is final: the ticket is closed and cannot be tried again */
  final?: boolean;
  /** the ticket closed because the time ran out with nothing submitted */
  timedOut?: boolean;
}

const noop = () => {};

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, k) => (k % 2 ? <code key={k} className="rounded bg-app-background px-1 font-lp-mono text-[12px]">{part}</code> : part))}
    </>
  );
}

export function WorkstationShell({ attempt, onClose }: { attempt: PublicAttempt; onClose: (closed: boolean) => void }) {
  const { challenge } = attempt;
  const station = challenge.tool_type ? WORKSTATIONS[challenge.tool_type] : undefined;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(attempt.lastGrade);
  const closed = Boolean(feedback?.passed || feedback?.final);
  // the answer waiting in the review step: nothing is sent until the student confirms it there
  const [review, setReview] = useState<unknown>(null);
  const expiryOff = useRef(false);
  const router = useRouter();
  const [requesterName, requesterTitle] = (challenge.requester ?? "").split("·").map((s) => s.trim());

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /**
   * The clock reached zero with nothing submitted. The server checks its own record of the time and, if it is up, closes the ticket as unanswered, which costs
   * what an answer with nothing right costs. A ticket that cannot expire this way (a Proof Session stage) answers "not_applicable" and is left alone.
   */
  async function timeUp() {
    if (submitting || closed || expiryOff.current) return;
    const res = await fetch(`/api/arena/domain/attempts/${attempt.attemptId}/expire`, { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      // a ticket that cannot expire this way will never be able to: stop asking
      const refusal = (await res?.json().catch(() => null)) as { code?: string } | null;
      if (refusal?.code === "not_applicable") expiryOff.current = true;
      return;
    }
    const body = (await res.json()) as { eloChange: number; careerEloChange: number; nextAvailableAt: string };
    setReview(null);
    setFeedback({ passed: false, final: true, timedOut: true, message: "Time ran out before an answer was submitted, so this ticket closed unanswered.", checks: [], eloChange: body.eloChange, careerEloChange: body.careerEloChange, nextAvailableAt: body.nextAvailableAt });
    announceArenaChange();
    router.refresh();
  }

  async function submit(submission: unknown) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/arena/domain/attempts/${attempt.attemptId}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submission }) });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not submit — try again.");
      else {
        setFeedback(data);
        // a closed ticket changes the ELO, the streak and the history: tell everything that shows them
        if (data.final || data.passed) {
          announceArenaChange();
          router.refresh();
        }
      }
    } catch {
      setError("Could not reach the server — your task is still open.");
    } finally {
      setSubmitting(false);
    }
  }

  const Tool = station?.component;
  const elo = ELO_BY_DIFFICULTY[challenge.difficulty as "easy" | "medium" | "hard"] ?? ELO_BY_DIFFICULTY.easy;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-app-background" role="dialog" aria-modal="true" aria-label={challenge.title}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-app-charcoal px-4 py-3 text-white sm:px-6">
        <button type="button" onClick={() => onClose(closed)} className="flex items-center gap-1.5 font-lp-body text-[13px] font-semibold text-white/80 hover:text-white">
          <ArrowLeft size={15} />
          Arena
        </button>
        <span className="hidden h-5 w-px bg-white/20 sm:block" />
        <span className="flex items-center gap-2 font-lp-body text-[13.5px] font-semibold">
          <Database size={15} className="text-app-orange" />
          {challenge.content.company ?? "Workspace"} · {station?.label ?? challenge.category}
        </span>
        <span className="ml-auto flex items-center gap-3 font-lp-mono text-[11.5px]">
          <span className="text-white/60">{attempt.area.name}</span>
          <span className={`rounded px-2 py-0.5 font-semibold ${closed ? (feedback?.final ? "bg-app-rose" : "bg-app-success") : "bg-white/10"}`}>{closed ? (feedback?.final ? "Closed" : feedback?.session ? "Stage passed" : feedback?.explain ? "Solved" : "Verified") : "In progress"}</span>
          {!closed && !ARENA_TEST_MODE && <WorkTimer attemptId={attempt.attemptId} limitSeconds={challenge.time_limit_minutes * 60} spentAtOpen={attempt.timeSpentSeconds ?? 0} running onTimeUp={timeUp} />}
          <span className="font-semibold text-app-orange" title={`Solving earns this after you explain your work. A wrong answer lowers your ELO by how wrong it is, up to ${elo}. If the time runs out with nothing submitted, the ticket closes unanswered and costs the full ${elo}.`}>+{elo} ELO if solved · up to −{elo} if wrong or unanswered</span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <aside className="shrink-0 border-b border-app-border bg-white p-5 lg:w-[340px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <p className="font-lp-mono text-[11px] text-app-muted">
            {challenge.category} · est. {challenge.time_limit_minutes} min
          </p>
          <h2 className="mt-1 font-lp-display text-[18px] font-semibold leading-snug text-app-charcoal">{challenge.title}</h2>
          {requesterName && (
            <div className="mt-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-blue-container font-lp-body text-[12px] font-bold text-app-blue">
                {requesterName
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="font-lp-body text-[12.5px] leading-tight text-app-charcoal">
                <span className="font-semibold">{requesterName}</span>
                <span className="block text-app-muted">{requesterTitle}</span>
              </span>
            </div>
          )}
          <p className="mt-3 rounded-lg bg-app-background px-3.5 py-3 font-lp-body text-[13px] leading-relaxed text-app-charcoal">{challenge.scenario}</p>
          <h3 className="mt-5 font-lp-body text-[12px] font-semibold text-app-charcoal">What&apos;s needed</h3>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {challenge.objective.split("\n").map((line, i) => (
              <li key={i} className="font-lp-body text-[13px] leading-relaxed text-app-charcoal">
                <Inline text={line} />
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {challenge.skill_tags.map((t) => (
              <span key={t} className="rounded bg-app-attention-container px-2 py-0.5 font-lp-mono text-[10.5px] text-app-attention">
                {t}
              </span>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6 lg:overflow-y-auto">
          {feedback && (
            <div className={`rounded-xl border px-5 py-4 ${feedback.passed ? "border-app-success/30 bg-app-success-container" : "border-app-warning/30 bg-app-warning-container"}`} role="status">
              <p className={`flex items-center gap-2 font-lp-body text-[14px] font-semibold ${feedback.passed ? "text-app-success" : "text-app-warning"}`}>
                {feedback.passed ? <CheckCircle2 size={17} /> : <CircleX size={17} />}
                {feedback.session ? (feedback.passed ? "Stage passed" : "Not quite — the stage is still open") : feedback.explain ? "Task solved. One step left" : feedback.passed ? `Verified${feedback.points ? ` · +${feedback.points} ELO` : ""}` : feedback.final ? (feedback.timedOut ? "Time is up" : "Submitted. This answer was not correct") : "Not quite — the task is still open"}
              </p>
              <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">{feedback.message}</p>
              {!feedback.passed && feedback.final && (
                <p className="mt-1.5 font-lp-body text-[13px] font-semibold text-app-rose" role="status">
                  {typeof (feedback.careerEloChange ?? feedback.eloChange) === "number" && (feedback.careerEloChange ?? feedback.eloChange)! < 0 ? `Your ELO ${feedback.careerEloChange ?? feedback.eloChange}, ${feedback.timedOut ? "the full value of the ticket, because nothing was submitted" : "based on how much of the answer was wrong"}. ` : ""}
                  A submitted answer is final, so this ticket is closed.
                  {feedback.nextAvailableAt && (
                    <>
                      {" "}Your next ticket opens in <Countdown target={feedback.nextAvailableAt} onDone={noop} />.
                    </>
                  )}
                </p>
              )}
              {feedback.checks.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {feedback.checks.map((c) => (
                    <li key={c.label} className={`flex items-center gap-1.5 font-lp-mono text-[11.5px] ${c.passed ? "text-app-success" : "text-app-rose"}`}>
                      {c.passed ? "✓" : "✗"} {c.label}
                    </li>
                  ))}
                </ul>
              )}
              {feedback.explain && (
                <p className="mt-2 font-lp-body text-[13px] text-app-charcoal">
                  Your rating is awarded after a short interview about your work. It then updates your portfolio and skill graph.
                </p>
              )}
              {feedback.passed && feedback.nextAvailableAt && (
                <p className="mt-2 font-lp-body text-[13px] text-app-charcoal">
                  Added to your portfolio as verified {attempt.area.name} evidence. Next task in <Countdown target={feedback.nextAvailableAt} onDone={noop} />.
                </p>
              )}
              {(feedback.passed || feedback.final) && (
                <button type="button" onClick={() => onClose(true)} className="mt-3 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white">
                  {feedback.session ? "Continue the session" : feedback.explain ? "Explain your work" : "Back to Arena"}
                </button>
              )}
            </div>
          )}
          {error && <p className="rounded-lg bg-app-rose-container px-4 py-2.5 font-lp-body text-[13px] text-app-rose">{error}</p>}
          {Tool ? (
            <Tool attemptId={attempt.attemptId} content={challenge.content as never} closed={closed} submitting={submitting} onSubmit={(submission: unknown) => setReview(submission)} lastChecks={feedback?.checks} />
          ) : (
            <p className="font-lp-body text-[13px] text-app-muted">This workstation isn&apos;t available in this version of the app.</p>
          )}
        </main>
      </div>
      {review !== null && (
        <ReviewDialog
          sections={reviewSubmission(challenge.tool_type ?? "", review, challenge.content)}
          gain={elo}
          loss={elo}
          busy={submitting}
          onBack={() => setReview(null)}
          onConfirm={async () => {
            await submit(review);
            setReview(null);
          }}
        />
      )}
    </div>
  );
}
