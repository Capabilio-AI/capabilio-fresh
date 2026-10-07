"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Countdown } from "./workstations/Countdown";

export interface ChallengeDetail {
  id: string;
  kind: string;
  title: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  time_limit_minutes: number;
  scenario: string;
  objective: string;
  language: string;
  starter_code: string | null;
  stdin: string | null;
  answer_unit: string | null;
  skill_tags: string[];
  solved?: boolean;
  /** set for ticket-style challenges that run in a workstation (opened on their own page) */
  workstation_template_id?: string | null;
}

export const DIFFICULTY_CLASS: Record<string, string> = {
  easy: "bg-app-success-container text-app-success",
  medium: "bg-app-warning-container text-app-warning",
  hard: "bg-app-attention-container text-app-attention",
};

export function ChallengeSolvePanel({ challenge, onDone }: { challenge: ChallengeDetail; onDone: () => void }) {
  const isNumeric = challenge.kind === "numeric";
  const [code, setCode] = useState(challenge.starter_code ?? "");
  const [answer, setAnswer] = useState("");
  const [working, setWorking] = useState("");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{ stdout: string; stderr: string } | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; pointsEarned: number } | null>(null);
  const [expiresAt] = useState(() => new Date(Date.now() + challenge.time_limit_minutes * 60_000).toISOString());

  async function handleRun() {
    setRunning(true);
    setOutput(null);
    const res = await fetch("/api/code/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: challenge.language, code, stdin: challenge.stdin ?? "" }),
    });
    setRunning(false);
    if (!res.ok) {
      setOutput({ stdout: "", stderr: "Could not run code — try again." });
      return;
    }
    const data = await res.json();
    setOutput({ stdout: data.stdout ?? "", stderr: data.stderr || data.compileError || "" });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const body = isNumeric ? { challengeId: challenge.id, answer: answer.trim(), working: working || undefined } : { challengeId: challenge.id, code };
    const res = await fetch("/api/arena/challenges/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not submit — try again.");
      return;
    }
    setResult({ isCorrect: data.isCorrect, pointsEarned: data.pointsEarned });
    if (!isNumeric) setOutput({ stdout: data.stdout, stderr: data.stderr });
  }

  if (result) {
    return (
      <div className="rounded-xl border border-app-border bg-white p-6 text-center">
        {result.isCorrect ? <CheckCircle2 size={28} className="mx-auto text-app-success" /> : <XCircle size={28} className="mx-auto text-app-attention" />}
        <p className="mt-3 font-lp-display text-[18px] font-semibold text-app-charcoal">{result.isCorrect ? "Correct!" : "Not quite"}</p>
        {result.isCorrect && <p className="mt-1 font-lp-mono text-[12px] text-app-muted">+{result.pointsEarned} Pts</p>}
        <div className="mt-5 flex justify-center gap-2">
          {!result.isCorrect && (
            <button type="button" onClick={() => setResult(null)} className="rounded-lg border border-app-border px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-app-charcoal">
              Try again
            </button>
          )}
          <button type="button" onClick={onDone} className="rounded-lg bg-app-charcoal px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white">
            Back to Challenges
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-app-border bg-white p-6">
      <div className="flex items-center gap-2">
        <span className={`w-fit rounded-full px-2 py-0.5 font-lp-mono text-[10px] font-semibold ${DIFFICULTY_CLASS[challenge.difficulty]}`}>{challenge.difficulty}</span>
        <span className="font-lp-mono text-[10.5px] text-app-muted">{challenge.category}</span>
        <span className="ml-auto flex items-center gap-1 font-lp-mono text-[11.5px] font-semibold text-app-charcoal">
          <Countdown target={expiresAt} onDone={onDone} />
        </span>
      </div>
      <h2 className="mt-2 font-lp-display text-[18px] font-semibold text-app-charcoal">{challenge.title}</h2>
      <p className="mt-2 font-lp-body text-[13px] leading-relaxed text-app-muted">{challenge.scenario}</p>
      <p className="mt-2 font-lp-body text-[13px] font-medium text-app-charcoal">{challenge.objective}</p>

      {isNumeric ? (
        <>
          <label className="mt-5 block font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-muted" htmlFor="working">
            Your working
          </label>
          <textarea
            id="working"
            value={working}
            onChange={(e) => setWorking(e.target.value)}
            rows={8}
            placeholder="Write the formulas and steps you used…"
            className="mt-1.5 w-full resize-y rounded-lg border border-app-border bg-app-background px-4 py-3 font-lp-mono text-[13px] leading-relaxed text-app-charcoal focus:outline-none focus:ring-2 focus:ring-app-charcoal/20"
          />
          <label className="mt-4 block font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-muted" htmlFor="answer">
            Final answer
          </label>
          <div className="mt-1.5 flex w-full max-w-xs items-center rounded-lg border border-app-border focus-within:ring-2 focus-within:ring-app-charcoal/20">
            <input
              id="answer"
              inputMode="decimal"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="e.g. 12.5"
              className="w-full rounded-l-lg px-4 py-2.5 font-lp-mono text-[14px] text-app-charcoal focus:outline-none"
            />
            {challenge.answer_unit && <span className="shrink-0 px-3 font-lp-mono text-[13px] font-semibold text-app-muted">{challenge.answer_unit}</span>}
          </div>
          <p className="mt-1.5 font-lp-body text-[11.5px] text-app-muted">Answers within 1% of the correct value are accepted.</p>
        </>
      ) : (
        <>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            rows={10}
            className="mt-4 w-full resize-none rounded-lg border border-app-border bg-app-charcoal px-4 py-3 font-lp-mono text-[13px] leading-relaxed text-white focus:outline-none"
          />
          {output && (
            <div className="mt-3 rounded-lg border border-app-border bg-app-background px-4 py-3 font-lp-mono text-[12.5px]">
              <p className="text-app-muted">Output:</p>
              <pre className="mt-1 whitespace-pre-wrap text-app-charcoal">{output.stdout || "(no output)"}</pre>
              {output.stderr && <pre className="mt-1 whitespace-pre-wrap text-app-attention">{output.stderr}</pre>}
            </div>
          )}
        </>
      )}

      {error && <p className="mt-3 font-lp-body text-[12.5px] font-semibold text-app-rose">{error}</p>}

      <div className="mt-4 flex gap-2">
        {!isNumeric && (
          <button type="button" onClick={handleRun} disabled={running} className="rounded-lg border border-app-border px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal disabled:opacity-60">
            {running ? "Running…" : "Run"}
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || (isNumeric && answer.trim() === "")}
          className="rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
        <button type="button" onClick={onDone} className="ml-auto font-lp-mono text-[11px] text-app-muted hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
