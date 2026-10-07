"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, CircleX, Clock, Lightbulb, Loader2, Monitor } from "lucide-react";
import type { AttemptResult, AttemptView } from "@/lib/arena-challenges/attempts";
import { buildSubmission, isLiveCheck } from "@/lib/arena-runtime/client/builders";
import { RUNTIMES } from "@/lib/arena-runtime/registry";
import { Countdown } from "../workstations/Countdown";
import { Workstation } from "../runtime/Workstation";
import type { Draft } from "../runtime/types";
import { AiHelp } from "./AiHelp";
import { RichText } from "./RichText";

const AUTOSAVE_MS = 1500;
type Saved = "idle" | "saving" | "saved" | "error";

/** One attempt: ticket brief and steps (left), the role's workstation (centre), checks and result (below). Pass/fail is decided by the server's deterministic checks. */
export function AttemptWorkspace({ initial }: { initial: AttemptView }) {
  const router = useRouter();
  const runtimeType = initial.workstation?.runtimeType ?? "QUESTION_FLOW";
  const descriptor = RUNTIMES[runtimeType];
  const [draft, setDraft] = useState<Draft>((initial.attempt.draft as Draft | null) ?? {});
  const [result, setResult] = useState<AttemptResult | null>(initial.attempt.result);
  const [hints, setHints] = useState(initial.hints);
  const [reflection, setReflection] = useState("");
  const [saved, setSaved] = useState<Saved>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(true);
  const dirty = useRef(false);
  const draftRef = useRef(draft);
  const finished = result !== null;

  const onDraft = useCallback((next: Draft) => {
    dirty.current = true;
    draftRef.current = next;
    setDraft(next);
  }, []);

  useEffect(() => {
    if (finished || !dirty.current) return;
    const t = setTimeout(async () => {
      setSaved("saving");
      const res = await fetch(`/api/arena/challenge-attempts/${initial.attempt.id}/draft`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft }) }).catch(() => null);
      dirty.current = false;
      setSaved(res?.ok ? "saved" : "error");
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [draft, finished, initial.attempt.id]);

  const submit = useCallback(async () => {
    if (submitting || finished) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/arena/challenge-attempts/${initial.attempt.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission: buildSubmission(runtimeType, draftRef.current, initial.checks), reflection: reflection.trim() || null }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Could not submit. Try again.");
      else setResult(body as AttemptResult);
    } catch {
      setError("Could not reach the server. Your work is kept — try again.");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, finished, initial.attempt.id, initial.checks, runtimeType, reflection]);

  async function useHint() {
    const res = await fetch(`/api/arena/challenge-attempts/${initial.attempt.id}/hint`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) return setError(body.error ?? "No hint available.");
    setHints((h) => ({ total: body.total, used: body.used, revealed: [...h.revealed, { order: body.order, body: body.body, penalty: body.penalty }] }));
  }

  async function tryAgain() {
    const res = await fetch("/api/arena/challenge-attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: initial.challenge.id }) });
    const body = await res.json();
    if (res.ok) router.push(`/arena/challenges/attempt/${body.attemptId}`);
    else setError(body.error ?? "Could not start a new attempt.");
  }

  const liveResults = (draft.results ?? {}) as Record<string, boolean>;
  const backHref = initial.challenge.track === "domain" ? "/arena/challenges/domain" : "/arena/challenges/stream";

  return (
    <div>
      <Link href={backHref} className="inline-flex items-center gap-1.5 font-lp-body text-[13px] text-app-muted hover:text-app-charcoal">
        <ArrowLeft size={14} /> Back to challenges
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-lp-mono text-[11.5px] uppercase text-app-muted">{`>_ ${initial.challenge.difficulty} · ${descriptor.label}`}</p>
          <h1 className="mt-1 font-lp-display text-[22px] font-semibold text-app-charcoal">{initial.challenge.title}</h1>
        </div>
        {!finished && (
          <div className="flex items-center gap-4 font-lp-body text-[13px] text-app-muted">
            <span aria-live="polite">{{ idle: "", saving: "Saving…", saved: "Saved", error: "Not saved — keep this tab open" }[saved]}</span>
            <span className="flex items-center gap-1.5 rounded-full border border-app-border bg-white px-3 py-1" title="Time left">
              <Clock size={13} />
              <Countdown target={initial.attempt.expiresAt} onDone={submit} />
            </span>
          </div>
        )}
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-app-border bg-white p-4 lg:self-start">
          <button type="button" onClick={() => setBriefOpen((o) => !o)} aria-expanded={briefOpen} className="flex w-full items-center justify-between font-lp-body text-[13px] font-semibold text-app-charcoal">
            Ticket
            {briefOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          {briefOpen && (
            <div className="mt-3">
              {initial.challenge.ticketBrief ? <RichText source={initial.challenge.ticketBrief} /> : <p className="font-lp-body text-[13px] text-app-muted">No brief provided.</p>}
              {initial.skills.length > 0 && (
                <p className="mt-3 font-lp-body text-[12px] text-app-muted">Skills tested: {initial.skills.map((s) => s.name).join(", ")}</p>
              )}
              <ol className="mt-4 flex flex-col gap-3">
                {initial.steps.map((s) => {
                  const mine = initial.checks.filter((c) => c.stepId === s.id);
                  return (
                    <li key={s.id}>
                      <p className="font-lp-body text-[13px] font-semibold text-app-charcoal">{s.step_order}. {s.title}</p>
                      <p className="font-lp-body text-[12.5px] text-app-muted">{s.instruction}</p>
                      {!finished && mine.filter(isLiveCheck).length > 0 && (
                        <ul className="mt-1">
                          {mine.filter(isLiveCheck).map((c) => (
                            <li key={c.id} className="flex items-center gap-1.5 font-lp-body text-[12px]">
                              {liveResults[c.id] ? <CheckCircle2 size={12} className="text-app-success" /> : <span aria-hidden className="h-3 w-3 rounded-full border border-app-border" />}
                              <span className="sr-only">{liveResults[c.id] ? "Passing: " : "Not yet: "}</span>
                              {c.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </aside>

        <main className="min-w-0 rounded-2xl border border-app-border bg-white p-4 md:p-5">
          {finished ? (
            <ResultPanel result={result} steps={initial.steps} onRetry={tryAgain} backHref={backHref} aiHelp={result.status === "PASSED" ? null : { attemptId: initial.attempt.id, used: initial.aiHelp.used, max: initial.aiHelp.max, penalty: initial.aiHelp.penalty }} />
          ) : (
            <>
              {descriptor.requiresDesktop && (
                <p className="mb-3 flex items-center gap-2 rounded-lg border border-app-border bg-app-background px-3 py-2 font-lp-body text-[12.5px] text-app-muted lg:hidden">
                  <Monitor size={14} /> This workstation works best on a desktop. You can read the ticket here, but open this page on a larger screen to work on it.
                </p>
              )}
              {!initial.runtimeEnabled && (
                <p role="alert" className="mb-3 rounded-lg border border-app-border bg-app-attention-container px-3 py-2 font-lp-body text-[13px] text-app-charcoal">
                  This workstation has been switched off for now. You can still read the ticket; try again later.
                </p>
              )}
              <div className={`${descriptor.requiresDesktop ? "hidden lg:block" : ""} ${initial.runtimeEnabled ? "" : "pointer-events-none opacity-50"}`} aria-hidden={!initial.runtimeEnabled}>
                <Workstation runtimeType={runtimeType} view={initial} draft={draft} onDraft={onDraft} disabled={submitting || !initial.runtimeEnabled} />
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-app-border pt-4">
                {hints.total > 0 && (
                  <div>
                    {hints.revealed.map((h) => (
                      <p key={h.order} className="mb-2 rounded-lg bg-app-attention-container px-3 py-2 font-lp-body text-[13px] text-app-charcoal">
                        <Lightbulb size={13} className="mr-1.5 inline" aria-hidden /> {h.body} <span className="text-app-muted">(−{h.penalty} score)</span>
                      </p>
                    ))}
                    {hints.used < hints.total && (
                      <button type="button" onClick={useHint} className="font-lp-body text-[12.5px] font-semibold text-app-blue hover:underline">
                        Show a hint ({hints.total - hints.used} left) — lowers your score
                      </button>
                    )}
                  </div>
                )}
                <AiHelp attemptId={initial.attempt.id} initialUsed={initial.aiHelp.used} max={initial.aiHelp.max} penalty={initial.aiHelp.penalty} finished={false} />
                <label className="font-lp-body text-[12px] font-semibold text-app-charcoal" htmlFor="reflection">How did you approach this? Did you use AI? (optional, not graded)</label>
                <textarea id="reflection" value={reflection} onChange={(e) => setReflection(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[13px]" />
                {error && <p role="alert" className="font-lp-body text-[13px] text-app-rose">{error}</p>}
                <div>
                  <button type="button" onClick={submit} disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-app-orange px-5 py-2.5 font-lp-body text-[14px] font-semibold text-white disabled:opacity-60">
                    {submitting && <Loader2 size={15} className="animate-spin" />} Submit and run checks
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ResultPanel({ result, steps, onRetry, backHref, aiHelp }: { result: AttemptResult; steps: AttemptView["steps"]; onRetry: () => void; backHref: string; aiHelp: { attemptId: string; used: number; max: number; penalty: number } | null }) {
  const passed = result.status === "PASSED";
  const groups = [...steps.map((s) => ({ key: s.id, title: `${s.step_order}. ${s.title}` })), { key: "other", title: "Other checks" }]
    .map((g) => ({ ...g, items: result.results.filter((r) => (g.key === "other" ? !r.stepId || !steps.some((s) => s.id === r.stepId) : r.stepId === g.key)) }))
    .filter((g) => g.items.length > 0);

  return (
    <section aria-label="Result" aria-live="polite">
      <p className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-lp-body text-[13px] font-semibold ${passed ? "bg-app-success-container text-app-success" : "bg-app-rose-container text-app-rose"}`}>
        {passed ? <CheckCircle2 size={15} /> : <CircleX size={15} />} {passed ? "Passed" : result.status === "EXPIRED" ? "Time ran out" : "Not passed yet"} · score {result.score}
      </p>
      <p className="mt-3 font-lp-body text-[13.5px] text-app-charcoal">{result.message}</p>
      {(result.eloDelta > 0 || result.pointsAwarded > 0) && (
        <p className="mt-1 font-lp-body text-[13px] font-semibold text-app-success">{result.eloDelta > 0 ? `+${result.eloDelta} ELO` : `+${result.pointsAwarded} points`}</p>
      )}
      <div className="mt-4 flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.key}>
            <h3 className="font-lp-body text-[13px] font-semibold text-app-charcoal">{g.title}</h3>
            <ul className="mt-1 flex flex-col gap-1">
              {g.items.map((r, i) => (
                <li key={r.checkId ?? i} className="flex items-center gap-2 font-lp-body text-[13px]">
                  {r.passed ? <CheckCircle2 size={14} className="text-app-success" /> : <CircleX size={14} className="text-app-rose" />}
                  <span className="sr-only">{r.passed ? "Passed: " : "Failed: "}</span>
                  {r.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {aiHelp && <div className="mt-5"><AiHelp attemptId={aiHelp.attemptId} initialUsed={aiHelp.used} max={aiHelp.max} penalty={aiHelp.penalty} finished /></div>}
      <div className="mt-6 flex gap-4 font-lp-body text-[13px] font-semibold">
        {!passed && <button type="button" onClick={onRetry} className="text-app-blue hover:underline">Try again</button>}
        <Link href={backHref} className="text-app-muted hover:text-app-charcoal">Back to challenges</Link>
      </div>
    </section>
  );
}
