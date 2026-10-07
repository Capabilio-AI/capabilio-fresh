"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { send } from "@/components/roadmap/v2/api";
import type { AnswerOutcome, DiagnosticSnapshot } from "@/lib/roadmap-visual/diagnostic-store";

const UNAVAILABLE = {
  NO_CAREER: "Choose a career first, then come back to take the check.",
  NO_TEMPLATE: "There's no roadmap for this career yet, so there's nothing to check against.",
  NO_ITEMS: "We haven't written questions for this career yet.",
  ALREADY_ASSESSED: "You already have evidence for every topic we can check. Nothing to do here.",
} as const;

export function DiagnosticRunner({ initial, career }: { initial: DiagnosticSnapshot; career: "primary" | "plan-b" }) {
  const router = useRouter();
  const [snap, setSnap] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string | null } | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [choices, setChoices] = useState<number[]>([]);
  const [text, setText] = useState("");
  const path = `/api/roadmap/diagnostic?career=${career}`;

  const call = async (body: unknown) => {
    setBusy(true);
    setError(null);
    const r = await send("POST", path, body);
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    return r.data;
  };
  const start = async (retake = false) => {
    const d = await call({ action: "start", retake });
    if (d) setSnap(d as unknown as DiagnosticSnapshot);
  };
  const skip = async () => {
    const d = await call({ action: "skip" });
    if (d) router.push("/dashboard/roadmap");
  };
  const q = snap.question;
  const ready = q ? (q.kind === "MCQ" ? choice !== null : q.kind === "MULTI_SELECT" ? choices.length > 0 : text.trim() !== "" && Number.isFinite(Number(text))) : false;
  const submit = async () => {
    if (!q) return;
    const response = q.kind === "MCQ" ? { choice } : q.kind === "MULTI_SELECT" ? { choices } : { value: Number(text) };
    const d = (await call({ action: "answer", itemId: q.id, response })) as unknown as AnswerOutcome | undefined;
    if (!d) return;
    setFeedback({ correct: d.correct, explanation: d.explanation });
    setSnap(d.snapshot);
  };
  const next = () => {
    setFeedback(null);
    setChoice(null);
    setChoices([]);
    setText("");
  };

  const card = "rounded-xl border border-app-border bg-white p-5";
  const primary = "rounded-md bg-app-charcoal px-4 py-2 font-lp-body text-[13px] text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-app-blue";

  if (snap.state === "UNAVAILABLE") return <div className={card}><p className="font-lp-body text-[13.5px]">{UNAVAILABLE[snap.reason ?? "NO_ITEMS"]}</p><Link href="/dashboard/roadmap" className="mt-3 inline-block text-app-blue hover:underline">Back to your roadmap</Link></div>;

  if (feedback) {
    return (
      <div className={card} role="status">
        <p className="font-lp-display text-[16px] font-semibold">{feedback.correct ? "Correct" : "Not quite"}</p>
        {feedback.explanation && <p className="mt-1 font-lp-body text-[13.5px] text-app-charcoal">{feedback.explanation}</p>}
        <button type="button" onClick={next} className={`${primary} mt-4`}>{snap.state === "COMPLETED" ? "See my results" : "Next question"}</button>
      </div>
    );
  }

  if (snap.state === "COMPLETED") {
    return (
      <div className={card}>
        <h2 className="font-lp-display text-[18px] font-semibold">Your baseline</h2>
        <ul className="mt-3 space-y-2">
          {(snap.results ?? []).map((r) => (
            <li key={r.skill} className="font-lp-body text-[13.5px]">
              <span className="font-medium">{r.skill}</span>: {r.level}/100 <span className="text-app-muted">({r.correct} of {r.answered} right{r.confidence === "low" ? ", low confidence: only a short check" : ""})</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 font-lp-body text-[12px] text-app-muted">{snap.formula} Topics we didn&apos;t ask about stay “not assessed”.</p>
        <div className="mt-4 flex gap-2"><Link href="/dashboard/roadmap" className={primary}>See my roadmap</Link><button type="button" onClick={() => void start(true)} disabled={busy} className="rounded-md border border-app-border px-4 py-2 font-lp-body text-[13px]">Retake the check</button></div>
      </div>
    );
  }

  if (snap.state === "IN_PROGRESS" && q) {
    const pct = snap.progress ? Math.round((snap.progress.skillsDone / Math.max(1, snap.progress.skillsTotal)) * 100) : 0;
    return (
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className={card}>
        <p className="font-lp-mono text-[10.5px] uppercase text-app-muted">{q.skill} · {q.difficulty} · topic {Math.min((snap.progress?.skillsDone ?? 0) + 1, snap.progress?.skillsTotal ?? 1)} of {snap.progress?.skillsTotal}</p>
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress" className="mt-1 h-1 rounded-full bg-app-background"><div className="h-1 rounded-full bg-app-orange" style={{ width: `${pct}%` }} /></div>
        <fieldset className="mt-4">
          <legend className="font-lp-body text-[14.5px] font-medium text-app-charcoal">{q.prompt}</legend>
          {q.kind === "NUMERIC" ? (
            <div className="mt-3"><label htmlFor="num" className="sr-only">Your answer</label><input id="num" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} className="w-40 rounded-md border border-app-border px-3 py-2 font-lp-body text-[14px]" /></div>
          ) : (
            <div className="mt-3 space-y-1.5">
              {q.options?.map((o, i) => (
                <label key={i} className="flex cursor-pointer items-start gap-2 rounded-md border border-app-border px-3 py-2 font-lp-body text-[13.5px] has-[:checked]:border-app-charcoal">
                  {q.kind === "MCQ" ? <input type="radio" name="opt" checked={choice === i} onChange={() => setChoice(i)} className="mt-1" /> : <input type="checkbox" checked={choices.includes(i)} onChange={() => setChoices((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))} className="mt-1" />}
                  <span>{o}</span>
                </label>
              ))}
              {q.kind === "MULTI_SELECT" && <p className="font-lp-body text-[11.5px] text-app-muted">Select all that apply.</p>}
            </div>
          )}
        </fieldset>
        {error && <p role="alert" className="mt-2 font-lp-body text-[12.5px] text-app-rose">{error}</p>}
        <div className="mt-4 flex items-center justify-between"><button type="submit" disabled={!ready || busy} className={primary}>Submit answer</button><button type="button" onClick={() => void skip()} disabled={busy} className="font-lp-body text-[12.5px] text-app-muted underline">Stop and skip the rest</button></div>
      </form>
    );
  }

  return (
    <div className={card}>
      <h2 className="font-lp-display text-[18px] font-semibold">{snap.state === "SKIPPED" ? "You skipped the baseline check" : "Check where you start"}</h2>
      <p className="mt-1.5 font-lp-body text-[13.5px] text-app-charcoal">A short quiz on the topics your career cares about most, so your roadmap starts from what you actually know. It takes about 10 minutes, is graded automatically, and you can stop any time and pick it up later.</p>
      {snap.covers && <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">It covers: {snap.covers.join(", ")}.</p>}
      <p className="mt-2 font-lp-body text-[12px] text-app-muted">Skipping is fine: those topics will simply show “not assessed”, never a zero.</p>
      {error && <p role="alert" className="mt-2 font-lp-body text-[12.5px] text-app-rose">{error}</p>}
      <div className="mt-4 flex gap-2"><button type="button" onClick={() => void start()} disabled={busy} className={primary}>{snap.state === "SKIPPED" ? "Take it now" : "Start the check"}</button>{snap.state !== "SKIPPED" && <button type="button" onClick={() => void skip()} disabled={busy} className="rounded-md border border-app-border px-4 py-2 font-lp-body text-[13px]">Skip for now</button>}</div>
    </div>
  );
}
