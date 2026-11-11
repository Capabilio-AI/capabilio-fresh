"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { PublicExercise } from "@/lib/practice/practice";
import type { TestResult } from "@/lib/practice/verify";
import { CodeEditor } from "./CodeEditor";

export type PracticeSource = { nodeKey: string } | { track: string; lessonKey: string };
type Progress = Record<string, { attempts: number; passed: boolean }>;
type Load = { s: "loading" } | { s: "pending"; waited: number } | { s: "none" } | { s: "unavailable" } | { s: "ready"; exercises: PublicExercise[]; progress: Progress };

const POLL_MS = 6000;
const GIVE_UP_MS = 6 * 60_000;
const query = (s: PracticeSource) => new URLSearchParams("nodeKey" in s ? { nodeKey: s.nodeKey } : { track: s.track, lessonKey: s.lessonKey }).toString();

/** Asks for the lesson's exercises. They are written and checked in the background the first time, so this asks again until they are ready. */
function useExercises(source: PracticeSource) {
  const [state, setState] = useState<Load>({ s: "loading" });
  const q = query(source);
  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    async function run() {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/skillstudio/exercises?${q}`);
          const body = (await res.json().catch(() => ({}))) as { status?: string; exercises?: PublicExercise[]; progress?: Progress };
          if (cancelled) return;
          if (body.status === "ready") return setState({ s: "ready", exercises: body.exercises ?? [], progress: body.progress ?? {} });
          if (body.status === "none" || !res.ok && res.status !== 202) return setState({ s: res.status === 200 ? "none" : "unavailable" });
          if (body.status === "unavailable") return setState({ s: "unavailable" });
        } catch {
          if (!cancelled) return setState({ s: "unavailable" });
        }
        if (Date.now() - started > GIVE_UP_MS) return setState({ s: "unavailable" });
        setState({ s: "pending", waited: Math.round((Date.now() - started) / 1000) });
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [q]);
  return state;
}

function Exercise({ ex, passedBefore }: { ex: PublicExercise; passedBefore: boolean }) {
  const [code, setCode] = useState(ex.starterCode);
  const [busy, setBusy] = useState(false);
  const [passed, setPassed] = useState(passedBefore);
  const [outcome, setOutcome] = useState<{ results: TestResult[]; error: string | null; passed: boolean } | { message: string } | null>(null);

  async function check() {
    setBusy(true);
    setOutcome(null);
    try {
      const res = await fetch("/api/skillstudio/exercises/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exerciseId: ex.id, code }) });
      const body = (await res.json().catch(() => ({}))) as { passed?: boolean; results?: TestResult[]; error?: string | null };
      if (!res.ok) setOutcome({ message: typeof body.error === "string" ? body.error : "That didn't work. Try again." });
      else {
        setOutcome({ results: body.results ?? [], error: body.error ?? null, passed: Boolean(body.passed) });
        if (body.passed) setPassed(true);
      }
    } catch {
      setOutcome({ message: "Couldn't reach the server. Check your connection." });
    }
    setBusy(false);
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">{ex.title}</h4>
        {passed && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ec] px-3 py-1 text-[12.5px] font-bold text-[#17784a]"><CheckCircle2 size={14} aria-hidden />Solved</span>}
      </div>
      <p className="max-w-[68ch] whitespace-pre-line text-[15px] leading-relaxed text-[var(--m-ink)]">{ex.instructions}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ex.visibleTests.map((t, i) => (
          <div key={i} className="rounded-lg bg-[var(--m-ground)] p-3 text-[13px]">
            <p className="font-bold text-[var(--m-muted)]">Example {i + 1}</p>
            <p className="mt-1 text-[var(--m-muted)]">Input</p><pre className="font-lp-mono text-[var(--m-ink)]">{t.input || "(none)"}</pre>
            <p className="mt-1 text-[var(--m-muted)]">Expected output</p><pre className="font-lp-mono text-[var(--m-ink)]">{t.expected}</pre>
          </div>
        ))}
      </div>
      <CodeEditor value={code} onChange={setCode} onRun={() => void check()} label={`Your solution for ${ex.title}`} minRows={8} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void check()} disabled={busy || code.trim().length === 0} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2 text-[14px] font-bold text-white disabled:opacity-60">
          {busy && <Loader2 size={15} aria-hidden className="animate-spin" />}{busy ? "Running the tests…" : "Run tests"}
        </button>
        <button type="button" onClick={() => { setCode(ex.starterCode); setOutcome(null); }} className="text-[13px] font-semibold text-[var(--m-muted)] hover:text-[var(--m-ink)]">Reset to starter code</button>
      </div>
      {outcome && "message" in outcome && <p role="alert" className="text-[14px] font-semibold text-red-700">{outcome.message}</p>}
      {outcome && "results" in outcome && (
        <div role="status" className="flex flex-col gap-2">
          <p className={`text-[15px] font-bold ${outcome.passed ? "text-[#17784a]" : "text-[var(--m-ink)]"}`}>{outcome.passed ? "All tests passed. Well done." : `${outcome.results.filter((r) => r.pass).length} of ${outcome.results.length} tests passed.`}</p>
          {outcome.error && <pre className="ss-scroll max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-red-300 bg-red-50 p-3 font-lp-mono text-[12.5px] text-red-800">{outcome.error}</pre>}
          <ul className="flex flex-col gap-1.5">
            {outcome.results.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[13.5px]">
                {r.pass ? <CheckCircle2 size={16} aria-hidden className="mt-0.5 shrink-0 text-[#17784a]" /> : <XCircle size={16} aria-hidden className="mt-0.5 shrink-0 text-red-600" />}
                {r.hidden ? <span>Hidden test: {r.pass ? "passed" : "failed"}</span> : (
                  <span>Example {i + 1}: {r.pass ? "passed" : <>expected <code className="font-lp-mono">{r.expected}</code> but got <code className="font-lp-mono">{r.got || "nothing"}</code></>}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/** Coding practice for a lesson, in the way W3Schools exercises work: read the task, write the code, run the tests. Learning progress only; it is never skill evidence. */
export function Practice({ source }: { source: PracticeSource }) {
  const state = useExercises(source);
  if (state.s === "none" || state.s === "loading") return null;
  return (
    <section aria-labelledby="practice-h" className="flex flex-col gap-4">
      <h3 id="practice-h" className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Practice: write the code</h3>
      {state.s === "pending" && <p role="status" className="flex items-center gap-2 text-[14px] text-[var(--m-muted)]"><Loader2 size={15} aria-hidden className="animate-spin" />Writing and checking exercises for this lesson. The first time this can take a minute or two.</p>}
      {state.s === "unavailable" && <p className="text-[14px] text-[var(--m-muted)]">Practice for this lesson isn&apos;t ready right now. Try again a little later.</p>}
      {state.s === "ready" && (
        <>
          <ul className="flex flex-col gap-4">{state.exercises.map((ex) => <Exercise key={ex.id} ex={ex} passedBefore={Boolean(state.progress[ex.id]?.passed)} />)}</ul>
          <p className="text-[12.5px] text-[var(--m-muted)]">Exercises are written by AI, and each was checked by running its own answer on the code runner before you saw it. Your code is run on a shared service, so it can occasionally be slow.</p>
        </>
      )}
    </section>
  );
}
