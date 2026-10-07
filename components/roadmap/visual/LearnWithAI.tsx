"use client";

import { useState } from "react";
import { send } from "@/components/roadmap/v2/api";
import type { TutorMode, TutorReply } from "@/lib/roadmap-visual/tutor";

/** The tutor's state for one topic, shared by the "Learn with AI" buttons and the ask bar so both feed the same answer area. */
export function useTutor(nodeKey: string, career: "primary" | "plan-b") {
  const [busy, setBusy] = useState<TutorMode | null>(null);
  const [reply, setReply] = useState<TutorReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (mode: TutorMode, question?: string) => {
    setBusy(mode);
    setError(null);
    const r = await send("POST", "/api/roadmap/ai", { nodeKey, career, mode, ...(question ? { question } : {}) });
    setBusy(null);
    if (!r.ok) return setError(r.error ?? "The tutor couldn't answer.");
    setReply((r.data as { reply: TutorReply }).reply);
  };
  return { busy, reply, error, run };
}
export type Tutor = ReturnType<typeof useTutor>;

const MODES: { mode: Exclude<TutorMode, "ask">; label: string }[] = [
  { mode: "quick", label: "Quick Explain" },
  { mode: "teach", label: "Teach Me" },
  { mode: "quiz", label: "Quiz me" },
];

export function LearnCard({ tutor }: { tutor: Tutor }) {
  return (
    <section className="rounded-xl border border-app-border p-4">
      <h3 className="flex items-center gap-2 font-lp-body text-[14px] font-semibold text-app-blue"><span aria-hidden>✦</span> Learn with AI</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {MODES.map((m, i) => (
          <button key={m.mode} type="button" disabled={tutor.busy !== null} onClick={() => void tutor.run(m.mode)} className={`rounded-md border px-3 py-1.5 font-lp-body text-[13px] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-app-blue ${tutor.busy === m.mode || (!tutor.busy && i === 0 && !tutor.reply) ? "border-app-blue bg-app-blue text-white" : "border-app-border bg-white text-app-charcoal hover:border-app-charcoal"}`}>{m.label}</button>
        ))}
      </div>
      <p className="mt-2 font-lp-body text-[11.5px] text-app-muted">AI answers can be wrong, so check anything important. Using this never changes your scores.</p>
    </section>
  );
}

export function TutorAnswer({ tutor }: { tutor: Tutor }) {
  const [picked, setPicked] = useState<Record<string, number>>({});
  return (
    <div aria-live="polite">
      {tutor.busy && <p role="status" className="font-lp-body text-[13px] text-app-muted">Thinking…</p>}
      {tutor.error && <p role="alert" className="font-lp-body text-[13px] text-app-rose">{tutor.error}</p>}
      {tutor.reply && !tutor.busy && (
        <section className="space-y-2 rounded-xl border border-app-border bg-[#fffbe6] p-4 font-lp-body text-[14px] text-app-charcoal">
          <h4 className="font-lp-display text-[16px] font-semibold">{tutor.reply.title}</h4>
          {tutor.reply.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          {tutor.reply.questions.map((q, qi) => (
            <fieldset key={qi} className="rounded-md border border-app-border bg-white p-2.5">
              <legend className="px-1 font-medium">{qi + 1}. {q.question}</legend>
              {q.options.map((o, oi) => (
                <label key={oi} className="flex items-start gap-2 py-0.5"><input type="radio" name={`q${qi}`} checked={picked[`${tutor.reply!.title}${qi}`] === oi} onChange={() => setPicked((p) => ({ ...p, [`${tutor.reply!.title}${qi}`]: oi }))} className="mt-1" /><span>{o}</span></label>
              ))}
              {picked[`${tutor.reply!.title}${qi}`] !== undefined && <p role="status" className="mt-1 text-[12.5px]">{picked[`${tutor.reply!.title}${qi}`] === q.answerIndex ? "Correct. " : `Not quite; the answer is “${q.options[q.answerIndex]}”. `}{q.why}</p>}
            </fieldset>
          ))}
          {tutor.reply.followUps.length > 0 && <div className="flex flex-wrap gap-1.5">{tutor.reply.followUps.map((f) => <button key={f} type="button" onClick={() => void tutor.run("ask", f)} className="rounded-full border border-app-border bg-white px-2.5 py-1 text-[12px] hover:border-app-charcoal">{f}</button>)}</div>}
        </section>
      )}
    </div>
  );
}

export function AskBar({ tutor, title }: { tutor: Tutor; title: string }) {
  const [q, setQ] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 3) { void tutor.run("ask", q.trim()); setQ(""); } }} className="border-t border-app-border p-3">
      <div className="flex items-center gap-2 rounded-xl border border-app-border px-3 py-2">
        <label className="sr-only" htmlFor="tutor-q">Ask anything about {title}</label>
        <input id="tutor-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder={`Ask anything about ${title}...`} className="min-w-0 flex-1 bg-transparent font-lp-body text-[14px] outline-none" />
        <button type="submit" disabled={tutor.busy !== null || q.trim().length < 3} aria-label="Ask" className="rounded-lg bg-[#fff200] px-3 py-1.5 text-[16px] font-bold text-black disabled:opacity-40">↑</button>
      </div>
    </form>
  );
}
