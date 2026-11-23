"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { CheckCircle2, ClipboardList, Loader2, Play } from "lucide-react";
import { CodeEditor } from "@/components/skillstudio/learn/CodeEditor";
import type { PublicExercise } from "@/lib/practice/practice";
import type { TestResult } from "@/lib/practice/verify";
import type { StepState } from "@/lib/languages/step-proof";

type Load = { s: "loading" } | { s: "pending" } | { s: "none" } | { s: "unavailable" } | { s: "ready"; exercises: PublicExercise[]; passed: Record<string, boolean> };
type Outcome = { results: TestResult[]; passed: boolean; error: string | null } | { message: string } | null;

/** Asks for the step's coding challenges. They are written and checked in the background the first time, so this asks a few times. */
function useChallenges(track: string, lessonKey: string): Load {
  const [state, setState] = useState<Load>({ s: "loading" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
        try {
          const res = await fetch(`/api/skillstudio/exercises?track=${encodeURIComponent(track)}&lessonKey=${encodeURIComponent(lessonKey)}`);
          const body = (await res.json().catch(() => ({}))) as { status?: string; exercises?: PublicExercise[]; progress?: Record<string, { passed: boolean }> };
          if (cancelled) return;
          if (body.status === "ready") return setState({ s: "ready", exercises: body.exercises ?? [], passed: Object.fromEntries(Object.entries(body.progress ?? {}).map(([k, v]) => [k, v.passed])) });
          if (body.status === "none") return setState({ s: "none" });
          if (body.status === "unavailable" || (!res.ok && res.status !== 202)) return setState({ s: "unavailable" });
        } catch { if (!cancelled) return setState({ s: "unavailable" }); }
        setState({ s: "pending" });
        await new Promise((r) => setTimeout(r, 6000));
      }
      if (!cancelled) setState({ s: "unavailable" });
    })();
    return () => { cancelled = true; };
  }, [track, lessonKey]);
  return state;
}

/**
 * Build: a live coding challenge about what the learner just studied. A problem statement, an editor, and Run & Check against tests (some hidden). The server
 * grades it and records the pass; this screen never decides whether the challenge is passed.
 */
export function BuildChallenge({ track, lessonKey, step, onStep }: { track: string; lessonKey: string; step: StepState; onStep: (s: StepState) => void }) {
  const load = useChallenges(track, lessonKey);
  const [at, setAt] = useState(0);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [passedNow, setPassedNow] = useState<Record<string, boolean>>({});

  if (load.s === "loading" || load.s === "pending") return <p role="status" className="flex items-center gap-2 px-1 py-4 text-[14px] text-[var(--m-muted)]"><Loader2 size={15} aria-hidden className="animate-spin" />Getting the coding challenge…</p>;
  if (load.s !== "ready" || load.exercises.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--m-ground)] p-4 text-[14.5px] leading-relaxed text-[var(--m-ink)]">
        <p className="font-bold">The coding challenge for this step is still being written.</p>
        <p className="mt-1 text-[var(--m-muted)]">You can finish this step with the questions. The module test at the end of the module has a coding problem for everything you learn here.</p>
      </div>
    );
  }
  const ex = load.exercises[Math.min(at, load.exercises.length - 1)];
  const code = codes[ex.id] ?? ex.starterCode;
  const passed = Boolean(passedNow[ex.id] ?? load.passed[ex.id]);
  const total = ex.visibleTests.length + ex.hiddenTests;
  const results = outcome && "results" in outcome ? outcome.results : null;
  const metCount = results ? results.filter((r) => r.pass).length : passed ? total : 0;

  async function check() {
    setBusy(true); setOutcome(null);
    try {
      const res = await fetch("/api/skillstudio/exercises/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exerciseId: ex.id, code }) });
      const body = (await res.json().catch(() => ({}))) as { passed?: boolean; results?: TestResult[]; error?: string | null; step?: StepState | null };
      if (!res.ok) { setOutcome({ message: typeof body.error === "string" ? body.error : "That did not work. Try again." }); return; }
      setOutcome({ results: body.results ?? [], passed: Boolean(body.passed), error: body.error ?? null });
      if (body.passed) setPassedNow((p) => ({ ...p, [ex.id]: true }));
      if (body.step) onStep(body.step);
    } catch { setOutcome({ message: "Could not reach the checker. Check your connection and try again." }); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-3">
      {load.exercises.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose a challenge">
          {load.exercises.map((e, i) => <button key={e.id} type="button" onClick={() => { setAt(i); setOutcome(null); }} aria-pressed={i === at} className={clsx("rounded-full px-3 py-1 text-[12.5px] font-bold", i === at ? "bg-[var(--m-ink)] text-white" : "bg-[var(--m-ground)] text-[var(--m-ink)]")}>Challenge {i + 1}{(passedNow[e.id] ?? load.passed[e.id]) ? " ✓" : ""}</button>)}
        </div>
      )}
      <div className="flex gap-3 rounded-2xl bg-[var(--m-ground)] p-4">
        <ClipboardList size={20} aria-hidden className="mt-0.5 shrink-0 text-[var(--m-accent-ink)]" />
        <div className="min-w-0"><p className="text-[15px] font-bold text-[var(--m-ink)]">Problem: {ex.title}</p><p className="mt-1 whitespace-pre-line text-[14.5px] leading-relaxed text-[var(--m-ink)]">{ex.instructions}</p></div>
      </div>
      {ex.visibleTests.length > 0 && (
        <details className="rounded-xl border border-[var(--m-rule)] px-4 py-2.5 text-[13.5px]">
          <summary className="cursor-pointer font-bold text-[var(--m-ink)]">Example tests ({ex.visibleTests.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">{ex.visibleTests.map((t, i) => <li key={i} className="font-lp-mono text-[12.5px]"><span className="text-[var(--m-muted)]">input </span>{t.input.trim() || "(none)"}<br /><span className="text-[var(--m-muted)]">expected </span>{t.expected.trim()}</li>)}</ul>
        </details>
      )}
      <CodeEditor value={code} onChange={(v) => setCodes((c) => ({ ...c, [ex.id]: v }))} onRun={() => void check()} label={`Your code for ${ex.title}`} minRows={9} maxRows={20} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => void check()} disabled={busy || code.trim().length === 0} className="inline-flex items-center gap-2 rounded-xl bg-[#17784a] px-5 py-2.5 text-[14.5px] font-bold text-white disabled:opacity-60">
          {busy ? <Loader2 size={16} aria-hidden className="animate-spin" /> : <Play size={16} aria-hidden />}{busy ? "Checking…" : "Run & Check"}
        </button>
        <div className="min-w-[140px]">
          <p className="ss-num text-[13px] font-bold text-[var(--m-ink)]">Tests: {metCount}/{total} passed</p>
          <div className="mt-1 flex gap-1" role="img" aria-label={`${metCount} of ${total} tests passed`}>{Array.from({ length: total }, (_, i) => <span key={i} className={clsx("h-1.5 flex-1 rounded-full", i < metCount ? "bg-[#17784a]" : "bg-[var(--m-rule)]")} />)}</div>
        </div>
      </div>
      {passed && <p role="status" className="flex items-center gap-2 text-[14.5px] font-bold text-[#0f5132]"><CheckCircle2 size={16} aria-hidden />Challenge passed.{step.complete ? " This step is complete." : step.checkDone ? "" : " Now answer the questions in Prove."}</p>}
      {outcome && "message" in outcome && <p role="alert" className="text-[14px] font-semibold text-red-700">{outcome.message}</p>}
      {outcome && "results" in outcome && (
        <div role="status" className="flex flex-col gap-1.5">
          {outcome.error && <p className="text-[13.5px] font-semibold text-red-700">{outcome.error}</p>}
          {outcome.results.map((r, i) => (
            <p key={i} className={clsx("rounded-lg px-3 py-2 text-[13px]", r.pass ? "bg-[#e8f5ee] text-[#0f5132]" : "bg-red-50 text-red-800")}>
              <span className="font-bold">Test {i + 1}{r.hidden ? " (hidden)" : ""}: {r.pass ? "passed" : "not passed"}</span>
              {!r.hidden && !r.pass && <span className="mt-1 block font-lp-mono text-[12px]">expected {r.expected.trim() || "(nothing)"}, got {r.got.trim() || "(nothing)"}</span>}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
