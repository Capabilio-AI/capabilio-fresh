"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const MAX_ANSWER_CHARS = 1200;
const SESSION_MINUTES = 15;

type Feedback = { strengths: string[]; improvements: string[]; notes: string[] };
type Result = { score: number; best: number; defended: boolean; feedback: Feedback; attemptsLeft: number };

async function call(repo: string, body: object): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch("/api/code-dna/defend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo, ...body }) });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

export function ExplainRepoPanel({ repo, initialBest, attemptsUsed, maxAttempts }: { repo: string; initialBest: number | null; attemptsUsed: number; maxAttempts: number }) {
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const { ok, data } = await call(repo, { action: "start" });
    setBusy(false);
    if (!ok) return setError(String(data.error ?? "Something went wrong."));
    const qs = data.questions as string[];
    setQuestions(qs);
    setAnswers(qs.map(() => ""));
    setResult(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const { ok, data } = await call(repo, { action: "submit", answers });
    setBusy(false);
    if (!ok) {
      if (data.expired) setQuestions(null);
      return setError(String(data.error ?? "Something went wrong."));
    }
    setResult(data as unknown as Result);
    setQuestions(null);
  }

  const attemptsLeft = result ? result.attemptsLeft : maxAttempts - attemptsUsed;
  const best = result?.best ?? initialBest;

  return (
    <div className="mt-6 flex flex-col gap-4">
      {best != null && (
        <p className="flex items-center gap-2 font-lp-body text-[13px] text-app-charcoal">
          <CheckCircle2 size={16} className="text-app-success" /> Best result so far: <span className="font-semibold">{best} / 100</span>
        </p>
      )}

      {result && (
        <div className="rounded-xl border border-app-border bg-white p-5">
          <p className="font-lp-display text-[18px] font-semibold text-app-charcoal">{result.score} / 100 {result.defended ? "— explained" : "— not yet convincing"}</p>
          {result.feedback.strengths.length > 0 && <ul className="mt-2 list-inside list-disc font-lp-body text-[12.5px] text-app-charcoal">{result.feedback.strengths.map((s) => <li key={s}>{s}</li>)}</ul>}
          {result.feedback.improvements.length > 0 && <ul className="mt-2 list-inside list-disc font-lp-body text-[12.5px] text-app-muted">{result.feedback.improvements.map((s) => <li key={s}>{s}</li>)}</ul>}
        </div>
      )}

      {questions ? (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <p className="font-lp-mono text-[11px] text-app-muted">You have {SESSION_MINUTES} minutes from when the questions appeared. If time runs out, no try is used.</p>
          {questions.map((q, i) => (
            <label key={q} className="flex flex-col gap-1.5">
              <span className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{i + 1}. {q}</span>
              <textarea
                required
                rows={4}
                maxLength={MAX_ANSWER_CHARS}
                value={answers[i]}
                onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
                className="rounded-lg border border-app-border bg-white p-3 font-lp-body text-[13px] text-app-charcoal"
              />
            </label>
          ))}
          <button type="submit" disabled={busy} className="flex w-fit items-center gap-2 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />} Submit answers
          </button>
        </form>
      ) : attemptsLeft > 0 ? (
        <button type="button" onClick={() => void start()} disabled={busy} className="flex w-fit items-center gap-2 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60">
          {busy && <Loader2 size={14} className="animate-spin" />} {attemptsUsed + (result ? 1 : 0) > 0 ? "Try again with new questions" : "Start"} ({attemptsLeft} {attemptsLeft === 1 ? "try" : "tries"} left)
        </button>
      ) : (
        <p className="font-lp-body text-[12.5px] text-app-muted">Both tries are used for this project.</p>
      )}

      {error && <p role="alert" className="font-lp-body text-[12.5px] text-app-attention">{error}</p>}
    </div>
  );
}
