"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

interface Props {
  attemptId: string;
  initialUsed: number;
  max: number;
  penalty: number;
  /** after submitting, explanations are free and describe what went wrong */
  finished: boolean;
}

/** Asks the AI tutor to explain a concept or a failure. It never grades and never gives the solution; while working, each use lowers the score. */
export function AiHelp({ attemptId, initialUsed, max, penalty, finished }: Props) {
  const [used, setUsed] = useState(initialUsed);
  const [question, setQuestion] = useState("");
  const [replies, setReplies] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/arena/challenge-attempts/${attemptId}/explain`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setError(body.error ?? "Could not reach the AI helper.");
    setReplies((r) => [...r, body.explanation]);
    setUsed(body.used);
    setQuestion("");
  }

  const left = max - used;
  return (
    <section aria-label="AI helper" className="rounded-xl border border-[var(--m-rule)] bg-app-background p-3">
      <h3 className="flex items-center gap-1.5 font-lp-body text-[13px] font-semibold text-[var(--m-ink)]"><Sparkles size={13} /> {finished ? "Understand what went wrong" : "Stuck? Ask the AI tutor"}</h3>
      <p className="mt-0.5 font-lp-body text-[12px] text-app-muted">
        It explains concepts but never gives the answer, and it doesn&apos;t grade your work.
        {!finished && ` Each question lowers your score by ${penalty}.`} {left} of {max} left.
      </p>
      {replies.map((r, i) => (
        <p key={i} className="mt-2 rounded-lg bg-white px-3 py-2 font-lp-body text-[13px] leading-relaxed text-[var(--m-ink)]">{r}</p>
      ))}
      {left > 0 && (
        <div className="mt-2 flex gap-2">
          <label htmlFor={`ai-q-${attemptId}`} className="sr-only">Your question</label>
          <input id={`ai-q-${attemptId}`} value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} placeholder={finished ? "Optional: what confused you?" : "What are you unsure about?"} className="min-w-0 flex-1 rounded-lg border border-[var(--m-rule)] bg-white px-3 py-1.5 font-lp-body text-[13px]" />
          <button type="button" onClick={ask} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-app-charcoal px-3.5 py-1.5 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-60">
            {busy && <Loader2 size={12} className="animate-spin" />} Explain
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 font-lp-body text-[12.5px] text-app-rose">{error}</p>}
    </section>
  );
}
