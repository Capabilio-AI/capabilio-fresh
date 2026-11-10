"use client";

import { useState } from "react";
import { Loader2, MessageCircleQuestion, Send } from "lucide-react";
import { crtPost } from "./api";

/** The CRT Coach: explains one question (and why a choice was tempting), or the lesson being read, and answers one follow-up at a time. */
export function CoachBox({ questionId, chosenKey, label = "Ask the coach" }: { questionId: string; chosenKey?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState("");

  async function send(text?: string) {
    setBusy(true);
    setError(null);
    try {
      const out = await crtPost<{ reply: string }>({ action: "coach", questionId, chosenKey, ask: text?.trim() || undefined });
      setReply(out.reply);
      setAsk("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The coach could not answer just now.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); void send(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-app-border px-3 py-1.5 font-lp-body text-[12.5px] font-semibold text-app-charcoal hover:bg-[var(--m-accent-soft)]">
        <MessageCircleQuestion size={14} aria-hidden /> {label}
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-app-border bg-[var(--m-ground)] p-3.5" aria-live="polite">
      <p className="font-lp-body text-[11px] font-bold uppercase tracking-wide text-app-muted">CRT Coach</p>
      {busy && !reply && <p className="mt-2 flex items-center gap-2 font-lp-body text-[13px] text-app-muted"><Loader2 size={14} className="animate-spin" aria-hidden /> Thinking…</p>}
      {reply && <p className="mt-2 whitespace-pre-line font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">{reply}</p>}
      {error && <p role="alert" className="mt-2 font-lp-body text-[13px] text-app-warning">{error}</p>}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ask.trim()) void send(ask); }}>
        <label className="sr-only" htmlFor="coach-ask">Ask a follow-up question</label>
        <input id="coach-ask" value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={500} placeholder="Ask a follow-up…" className="min-w-0 flex-1 rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[13px] text-app-charcoal" />
        <button type="submit" disabled={busy || !ask.trim()} aria-label="Send" className="rounded-lg bg-[var(--m-ink)] px-3 text-white disabled:opacity-50"><Send size={14} aria-hidden /></button>
      </form>
    </div>
  );
}
