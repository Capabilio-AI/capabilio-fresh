"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export interface ChallengeDetail {
  id: string;
  title: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  time_limit_minutes: number;
  scenario: string;
  objective: string;
  language: string;
  starter_code: string | null;
  stdin: string | null;
  skill_tags: string[];
  solved?: boolean;
}

export const DIFFICULTY_CLASS: Record<string, string> = {
  easy: "bg-app-success-container text-app-success",
  medium: "bg-app-warning-container text-app-warning",
  hard: "bg-app-attention-container text-app-attention",
};

export function ChallengeSolvePanel({ track, challenge, onDone }: { track: "stream" | "domain"; challenge: ChallengeDetail; onDone: () => void }) {
  const [code, setCode] = useState(challenge.starter_code ?? "");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [output, setOutput] = useState<{ stdout: string; stderr: string } | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; pointsEarned: number } | null>(null);

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
    const res = await fetch(`/api/arena/challenges/${track}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId: challenge.id, code }),
    });
    setSubmitting(false);
    if (!res.ok) return;
    const data = await res.json();
    setResult({ isCorrect: data.isCorrect, pointsEarned: data.pointsEarned });
    setOutput({ stdout: data.stdout, stderr: data.stderr });
  }

  if (result) {
    return (
      <div className="rounded-xl border border-app-border bg-white p-6 text-center">
        {result.isCorrect ? <CheckCircle2 size={28} className="mx-auto text-app-success" /> : <XCircle size={28} className="mx-auto text-app-attention" />}
        <p className="mt-3 font-lp-display text-[18px] font-semibold text-app-charcoal">{result.isCorrect ? "Correct!" : "Not quite"}</p>
        {result.isCorrect && <p className="mt-1 font-lp-mono text-[12px] text-app-muted">+{result.pointsEarned} Pts</p>}
        <button type="button" onClick={onDone} className="mt-5 rounded-lg bg-app-charcoal px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white">
          Back to Challenges
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-app-border bg-white p-6">
      <span className={`w-fit rounded-full px-2 py-0.5 font-lp-mono text-[10px] font-semibold ${DIFFICULTY_CLASS[challenge.difficulty]}`}>{challenge.difficulty}</span>
      <h2 className="mt-2 font-lp-display text-[18px] font-semibold text-app-charcoal">{challenge.title}</h2>
      <p className="mt-2 font-lp-body text-[13px] leading-relaxed text-app-muted">{challenge.scenario}</p>
      <p className="mt-2 font-lp-body text-[13px] font-medium text-app-charcoal">{challenge.objective}</p>

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

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={handleRun} disabled={running} className="rounded-lg border border-app-border px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal disabled:opacity-60">
          {running ? "Running…" : "Run"}
        </button>
        <button type="button" onClick={handleSubmit} disabled={submitting} className="rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60">
          {submitting ? "Submitting…" : "Submit"}
        </button>
        <button type="button" onClick={onDone} className="ml-auto font-lp-mono text-[11px] text-app-muted hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
