"use client";

import { useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import clsx from "clsx";
import type { TutorMode } from "@/lib/roadmap-visual/tutor";
import { useTutor } from "@/components/roadmap/visual/LearnWithAI";

const MODES: { mode: Exclude<TutorMode, "ask">; label: string; hint: string }[] = [
  { mode: "quick", label: "Explain it simply", hint: "A short explanation with a small example" },
  { mode: "teach", label: "Teach me step by step", hint: "A guided walk through the idea" },
  { mode: "quiz", label: "Quiz me", hint: "Check what you understood" },
];

/** The lesson's AI tutor: three ways in, a question bar, and an answer that can quiz you. It explains; it never changes a score. */
export function LessonTutor({ nodeKey, title }: { nodeKey: string; title: string }) {
  const tutor = useTutor(nodeKey, "primary");
  const [question, setQuestion] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const reply = tutor.reply;

  return (
    <section aria-labelledby="tutor-h" className="rounded-2xl border border-[var(--m-ink)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--m-rule)] px-5 py-4">
        <h2 id="tutor-h" className="flex items-center gap-2 font-lp-display text-[20px] font-bold text-[var(--m-ink)]"><Sparkles size={18} aria-hidden className="text-[var(--m-accent)]" />Learn with your tutor</h2>
        <div role="group" aria-label="How do you want to learn this?" className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              title={m.hint}
              disabled={tutor.busy !== null}
              onClick={() => void tutor.run(m.mode)}
              className={clsx("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] font-bold transition-colors disabled:opacity-60 motion-reduce:transition-none", tutor.busy === m.mode ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-[var(--m-rule)] bg-white text-[var(--m-ink)] hover:border-[var(--m-ink)]")}
            >
              {tutor.busy === m.mode && <Loader2 size={13} aria-hidden className="animate-spin" />}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="ss-scroll max-h-[34rem] min-h-40 overflow-y-auto px-5 py-5">
        {tutor.busy && !reply && (
          <div role="status" className="flex flex-col gap-2.5" aria-label="The tutor is writing">
            {[92, 78, 85].map((w, i) => <span key={i} className="h-3.5 animate-pulse rounded-full bg-[var(--m-rule)] motion-reduce:animate-none" style={{ width: `${w}%` }} />)}
          </div>
        )}
        {tutor.error && <p role="alert" className="text-[14px] font-bold text-red-600">{tutor.error}</p>}
        {!tutor.busy && !tutor.error && !reply && (
          <p className="max-w-[56ch] text-[15px] leading-relaxed text-[var(--m-muted)]">Start with a quick explanation of {title}, ask your own question below, or test yourself with a quiz.</p>
        )}
        {reply && (
          <div className={clsx("flex flex-col gap-3", tutor.busy && "opacity-50")}>
            <h3 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">{reply.title}</h3>
            {reply.paragraphs.map((p, i) => <p key={i} className="max-w-[68ch] text-[15.5px] leading-relaxed text-[var(--m-ink)]">{p}</p>)}
            {reply.questions.map((q, qi) => {
              const id = `${reply.title}${qi}`;
              const choice = picked[id];
              return (
                <fieldset key={id} className="rounded-xl border border-[var(--m-rule)] p-4">
                  <legend className="px-1 text-[15px] font-bold text-[var(--m-ink)]">{qi + 1}. {q.question}</legend>
                  <div className="mt-1 flex flex-col gap-1.5">
                    {q.options.map((o, oi) => (
                      <label key={oi} className={clsx("flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-[14.5px] transition-colors motion-reduce:transition-none", choice === oi ? "border-[var(--m-ink)] bg-[var(--m-ground)]" : "border-transparent hover:bg-[var(--m-ground)]")}>
                        <input type="radio" name={id} checked={choice === oi} onChange={() => setPicked((p) => ({ ...p, [id]: oi }))} className="mt-1 accent-[var(--m-ink)]" />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                  {choice !== undefined && (
                    <p role="status" className={clsx("mt-2 text-[14px]", choice === q.answerIndex ? "font-bold text-[#17784a]" : "text-[var(--m-ink)]")}>
                      {choice === q.answerIndex ? "Correct. " : `Not quite. The answer is “${q.options[q.answerIndex]}”. `}{q.why}
                    </p>
                  )}
                </fieldset>
              );
            })}
            {reply.followUps.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {reply.followUps.map((f) => <button key={f} type="button" disabled={tutor.busy !== null} onClick={() => void tutor.run("ask", f)} className="rounded-full border border-[var(--m-rule)] px-3 py-1.5 text-[13px] text-[var(--m-ink)] hover:border-[var(--m-ink)] disabled:opacity-50">{f}</button>)}
              </div>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = question.trim();
          if (q.length >= 3) { void tutor.run("ask", q); setQuestion(""); }
        }}
        className="border-t border-[var(--m-rule)] p-3"
      >
        <div className="flex items-center gap-2 rounded-full border border-[var(--m-rule)] bg-white py-1.5 pl-4 pr-1.5 focus-within:border-[var(--m-ink)]">
          <label className="sr-only" htmlFor="tutor-question">Ask anything about {title}</label>
          <input id="tutor-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder={`Ask anything about ${title}`} className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[var(--m-ink)] outline-none placeholder:text-[var(--m-muted)]" />
          <button type="submit" disabled={tutor.busy !== null || question.trim().length < 3} aria-label="Ask the tutor" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--m-accent)] text-[var(--m-ink)] transition-opacity disabled:opacity-40"><ArrowUp size={17} aria-hidden /></button>
        </div>
        <p className="mt-2 px-2 text-[12.5px] text-[var(--m-muted)]">AI answers can be wrong, so check anything important. Using the tutor never changes your scores.</p>
      </form>
    </section>
  );
}
