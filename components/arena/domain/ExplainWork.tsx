"use client";

import { useState } from "react";
import { CheckCircle2, CircleX, Loader2, MessagesSquare } from "lucide-react";
import { ELO_BY_DIFFICULTY } from "@/lib/arena-workstations/types";
import { MAX_ANSWER_CHARS, PASS_SCORE } from "@/lib/arena-workstations/explain-rules";
import type { ExplainOutcome, ExplainView } from "@/lib/arena-workstations/explain-attempts";
import { Countdown } from "../workstations/Countdown";
import type { PublicAttempt } from "../workstations/WorkstationShell";

const BOX = "rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-8";
const PRIMARY = "inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-6 py-3 font-lp-body text-[14px] font-bold text-white transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0";
const QUIET = "font-lp-body text-[13px] font-semibold text-[var(--m-muted)] underline-offset-2 hover:text-[var(--m-ink)] hover:underline disabled:opacity-60";

async function call<T>(attemptId: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/arena/domain/attempts/${attemptId}/explain`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    return res.ok ? { ok: true, data: data as T } : { ok: false, error: data.error ?? "Something went wrong. Try again." };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection." };
  }
}

function Feedback({ outcome }: { outcome: ExplainOutcome }) {
  const f = outcome.feedback;
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {f.strengths.length > 0 && (
        <div><h4 className="font-lp-body text-[13px] font-bold text-[var(--m-ink)]">What worked</h4><ul className="mt-1.5 list-disc pl-5 font-lp-body text-[13.5px] leading-relaxed text-[var(--m-muted)]">{f.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
      )}
      {f.improvements.length > 0 && (
        <div><h4 className="font-lp-body text-[13px] font-bold text-[var(--m-ink)]">What to sharpen</h4><ul className="mt-1.5 list-disc pl-5 font-lp-body text-[13.5px] leading-relaxed text-[var(--m-muted)]">{f.improvements.map((s) => <li key={s}>{s}</li>)}</ul></div>
      )}
    </div>
  );
}

/**
 * A solved task waits here. The user sees what they handed in, answers four AI questions about their own work, and only a passing
 * explanation awards the rating (and the portfolio entry and skill graph update that come with it).
 */
export function ExplainWork({ attempt, onDone }: { attempt: PublicAttempt; onDone: () => void }) {
  const { challenge, explain } = attempt;
  const elo = ELO_BY_DIFFICULTY[challenge.difficulty as "easy" | "medium" | "hard"] ?? ELO_BY_DIFFICULTY.easy;
  const [view, setView] = useState<ExplainView | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<ExplainOutcome | null>(null);
  const [busy, setBusy] = useState<"start" | "submit" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [requesterName] = (challenge.requester ?? "").split("·").map((s) => s.trim());

  async function start() {
    setBusy("start"); setError(null); setOutcome(null);
    const r = await call<ExplainView>(attempt.attemptId, { action: "start" });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setView(r.data);
    setAnswers(r.data.questions.map(() => ""));
  }

  async function submit() {
    setBusy("submit"); setError(null);
    const r = await call<ExplainOutcome>(attempt.attemptId, { action: "submit", answers });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setOutcome(r.data);
    if (r.data.outcome === "retry") setView(null);
  }

  async function skip() {
    setBusy("skip"); setError(null);
    const r = await call<{ nextAvailableAt: string }>(attempt.attemptId, { action: "skip" });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    onDone();
  }

  const tries = explain ? Math.max(0, explain.maxAttempts - explain.attempts) : 1;
  const finished = outcome && outcome.outcome !== "retry";
  const ready = answers.length > 0 && answers.every((a) => a.trim().length > 0);

  return (
    <section aria-labelledby="explain-h" className="flex flex-col gap-5">
      <div className={BOX}>
        <p className="flex items-center gap-2 font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)]"><CheckCircle2 size={16} aria-hidden /> Task solved: {challenge.title}</p>
        <h2 id="explain-h" className="mt-2 font-lp-display text-[26px] font-bold leading-tight text-[var(--m-ink)]">Now explain your work to earn your rating</h2>
        <p className="mt-1 max-w-2xl font-lp-body text-[14px] leading-relaxed text-app-muted">
          Your answer was correct, but your <span className="font-semibold text-[var(--m-ink)]">+{elo} ELO</span> is awarded after a short interview about how you got there. It then updates your portfolio and your skill graph.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-[var(--m-ground)] p-4">
            <h3 className="font-lp-body text-[12.5px] font-bold text-[var(--m-ink)]">The request{requesterName ? ` from ${requesterName}` : ""}</h3>
            <p className="mt-1.5 font-lp-body text-[13.5px] leading-relaxed text-[var(--m-muted)]">{challenge.scenario}</p>
          </div>
          <div className="rounded-2xl bg-[var(--m-ground)] p-4">
            <h3 className="font-lp-body text-[12.5px] font-bold text-[var(--m-ink)]">What you handed in</h3>
            <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap font-lp-mono text-[12px] leading-relaxed text-[var(--m-muted)]">{explain?.submission || "Your work was saved."}</pre>
          </div>
        </div>
        {explain && explain.checks.length > 0 && (
          <p className="mt-3 font-lp-body text-[12.5px] text-[var(--m-muted)]"><span className="font-semibold text-[var(--m-ink)]">Checks passed:</span> {explain.checks.join("; ")}</p>
        )}

        {!view && !finished && (
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button type="button" onClick={start} disabled={busy !== null} className={PRIMARY}>
              {busy === "start" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <MessagesSquare size={15} aria-hidden />}
              {busy === "start" ? "Preparing your interview…" : outcome?.outcome === "retry" ? "Try again with new questions" : "Start the interview"}
            </button>
            {!confirmSkip ? (
              <button type="button" onClick={() => setConfirmSkip(true)} className={QUIET}>Skip, without a rating</button>
            ) : (
              <span className="flex flex-wrap items-center gap-3 font-lp-body text-[13px] text-[var(--m-muted)]">
                You will get no rating for this task.
                <button type="button" onClick={skip} disabled={busy !== null} className={QUIET}>{busy === "skip" ? "Closing…" : "Yes, skip it"}</button>
                <button type="button" onClick={() => setConfirmSkip(false)} className={QUIET}>Keep going</button>
              </span>
            )}
            <p className="w-full font-lp-body text-[12.5px] text-[var(--m-muted)]">{tries === 1 ? "You have one try left." : `You have ${tries} tries.`} You need {PASS_SCORE} out of 100.</p>
          </div>
        )}
      </div>

      {view && !finished && (
        <div className={BOX}>
          <h3 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">The interview</h3>
          <p className="mt-1 font-lp-body text-[13.5px] text-app-muted">Answer in your own words, two to four sentences each. Specific answers about your own work score best.</p>
          {view.last && <p className="mt-3 rounded-2xl bg-[var(--m-accent-soft)] px-4 py-3 font-lp-body text-[13.5px] font-semibold text-[var(--m-accent-ink)]">Your last try scored {view.last.score}. These are new questions.</p>}
          <ol className="mt-5 flex flex-col gap-5">
            {view.questions.map((q, i) => (
              <li key={q}>
                <label className="block font-lp-body text-[14px] font-bold text-[var(--m-ink)]">
                  <span className="mr-2 text-[var(--m-accent-ink)]">{i + 1}.</span>{q}
                  <textarea value={answers[i] ?? ""} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} rows={4} maxLength={MAX_ANSWER_CHARS} disabled={busy === "submit"} className="mt-2 w-full resize-y rounded-xl border border-[var(--m-rule)] bg-white px-4 py-3 font-lp-body text-[14px] font-normal text-[var(--m-ink)] outline-none focus:border-[var(--m-ink)] focus:ring-2 focus:ring-[var(--m-accent)]/25" />
                </label>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button type="button" onClick={submit} disabled={!ready || busy !== null} className={PRIMARY}>
              {busy === "submit" && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {busy === "submit" ? "Scoring your answers…" : "Submit my answers"}
            </button>
            <span className="font-lp-body text-[12.5px] text-[var(--m-muted)]">You can only submit when all four are answered.</span>
          </div>
        </div>
      )}

      {error && <p role="alert" className="rounded-2xl bg-[var(--m-accent-soft)] px-4 py-3 font-lp-body text-[14px] font-semibold text-[var(--m-accent-ink)]">{error}</p>}

      {outcome && (
        <div role="status" className={BOX}>
          {outcome.outcome === "award" ? (
            <>
              <p className="flex items-center gap-2 font-lp-display text-[22px] font-bold text-[var(--m-ink)]"><CheckCircle2 size={20} className="text-app-success" aria-hidden /> Verified: {outcome.score} out of 100, +{outcome.points} ELO</p>
              <p className="mt-1 font-lp-body text-[14px] text-app-muted">Your rating is updated, the task is in your portfolio as verified evidence, and your skill graph is refreshed. Your next ticket opens in <Countdown target={outcome.nextAvailableAt} onDone={onDone} />.</p>
            </>
          ) : outcome.outcome === "retry" ? (
            <p className="flex items-center gap-2 font-lp-display text-[22px] font-bold text-[var(--m-ink)]"><CircleX size={20} className="text-app-warning" aria-hidden /> {outcome.score} out of 100: not enough yet. You have {outcome.triesLeft} more {outcome.triesLeft === 1 ? "try" : "tries"}.</p>
          ) : (
            <>
              <p className="flex items-center gap-2 font-lp-display text-[22px] font-bold text-[var(--m-ink)]"><CircleX size={20} className="text-app-warning" aria-hidden /> {outcome.score} out of 100: the task is closed without a rating.</p>
              <p className="mt-1 font-lp-body text-[14px] text-app-muted">The work you did was correct, but a rating needs an explanation that shows you understand it. Your next ticket opens in <Countdown target={outcome.nextAvailableAt} onDone={onDone} />.</p>
            </>
          )}
          <Feedback outcome={outcome} />
          {finished && <button type="button" onClick={onDone} className={`${PRIMARY} mt-5`}>Back to Arena</button>}
        </div>
      )}
    </section>
  );
}
