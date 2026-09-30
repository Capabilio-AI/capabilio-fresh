"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleX, Database } from "lucide-react";
import { ELO_BY_DIFFICULTY } from "@/lib/arena-workstations/types";
import { Countdown } from "./Countdown";
import { WORKSTATIONS } from "./registry";

export interface PublicAttempt {
  attemptId: string;
  assignedAt: string;
  status: string;
  submissionCount: number;
  lastGrade: { passed: boolean; message: string; checks: { label: string; passed: boolean }[] } | null;
  area: { key: string | null; name: string | null };
  challenge: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
    time_limit_minutes: number;
    scenario: string;
    objective: string;
    requester: string | null;
    skill_tags: string[];
    tool_type: string | null;
    content: { company?: string } & Record<string, unknown>;
  };
}

interface Feedback {
  passed: boolean;
  message: string;
  checks: { label: string; passed: boolean }[];
  points?: number;
  nextAvailableAt?: string;
}

const noop = () => {};

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, k) => (k % 2 ? <code key={k} className="rounded bg-app-background px-1 font-lp-mono text-[12px]">{part}</code> : part))}
    </>
  );
}

export function WorkstationShell({ attempt, onClose }: { attempt: PublicAttempt; onClose: (closed: boolean) => void }) {
  const { challenge } = attempt;
  const station = challenge.tool_type ? WORKSTATIONS[challenge.tool_type] : undefined;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(attempt.lastGrade);
  const closed = Boolean(feedback?.passed);
  const [requesterName, requesterTitle] = (challenge.requester ?? "").split("·").map((s) => s.trim());
  const [expiresAt] = useState(() => new Date(Date.parse(attempt.assignedAt) + challenge.time_limit_minutes * 60_000).toISOString());

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  async function submit(submission: unknown) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/arena/domain/attempts/${attempt.attemptId}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submission }) });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not submit — try again.");
      else setFeedback(data);
    } catch {
      setError("Could not reach the server — your task is still open.");
    } finally {
      setSubmitting(false);
    }
  }

  const Tool = station?.component;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-app-background" role="dialog" aria-modal="true" aria-label={challenge.title}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-app-charcoal px-4 py-3 text-white sm:px-6">
        <button type="button" onClick={() => onClose(closed)} className="flex items-center gap-1.5 font-lp-body text-[13px] font-semibold text-white/80 hover:text-white">
          <ArrowLeft size={15} />
          Arena
        </button>
        <span className="hidden h-5 w-px bg-white/20 sm:block" />
        <span className="flex items-center gap-2 font-lp-body text-[13.5px] font-semibold">
          <Database size={15} className="text-app-orange" />
          {challenge.content.company ?? "Workspace"} · {station?.label ?? challenge.category}
        </span>
        <span className="ml-auto flex items-center gap-3 font-lp-mono text-[11.5px]">
          <span className="text-white/60">{attempt.area.name}</span>
          <span className={`rounded px-2 py-0.5 font-semibold ${closed ? "bg-app-success" : "bg-white/10"}`}>{closed ? "Verified" : "In progress"}</span>
          {!closed && <Countdown target={expiresAt} onDone={() => onClose(false)} />}
          <span className="font-semibold text-app-orange">+{ELO_BY_DIFFICULTY[challenge.difficulty as "easy" | "medium" | "hard"] ?? ELO_BY_DIFFICULTY.easy} ELO</span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <aside className="shrink-0 border-b border-app-border bg-white p-5 lg:w-[340px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <p className="font-lp-mono text-[11px] text-app-muted">
            {challenge.category} · est. {challenge.time_limit_minutes} min
          </p>
          <h2 className="mt-1 font-lp-display text-[18px] font-semibold leading-snug text-app-charcoal">{challenge.title}</h2>
          {requesterName && (
            <div className="mt-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-blue-container font-lp-body text-[12px] font-bold text-app-blue">
                {requesterName
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="font-lp-body text-[12.5px] leading-tight text-app-charcoal">
                <span className="font-semibold">{requesterName}</span>
                <span className="block text-app-muted">{requesterTitle}</span>
              </span>
            </div>
          )}
          <p className="mt-3 rounded-lg bg-app-background px-3.5 py-3 font-lp-body text-[13px] leading-relaxed text-app-charcoal">{challenge.scenario}</p>
          <h3 className="mt-5 font-lp-body text-[12px] font-semibold text-app-charcoal">What&apos;s needed</h3>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {challenge.objective.split("\n").map((line, i) => (
              <li key={i} className="font-lp-body text-[13px] leading-relaxed text-app-charcoal">
                <Inline text={line} />
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {challenge.skill_tags.map((t) => (
              <span key={t} className="rounded bg-app-attention-container px-2 py-0.5 font-lp-mono text-[10.5px] text-app-attention">
                {t}
              </span>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6 lg:overflow-y-auto">
          {feedback && (
            <div className={`rounded-xl border px-5 py-4 ${feedback.passed ? "border-app-success/30 bg-app-success-container" : "border-app-warning/30 bg-app-warning-container"}`} role="status">
              <p className={`flex items-center gap-2 font-lp-body text-[14px] font-semibold ${feedback.passed ? "text-app-success" : "text-app-warning"}`}>
                {feedback.passed ? <CheckCircle2 size={17} /> : <CircleX size={17} />}
                {feedback.passed ? `Verified${feedback.points ? ` · +${feedback.points} ELO` : ""}` : "Not quite — the task is still open"}
              </p>
              <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">{feedback.message}</p>
              {feedback.checks.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {feedback.checks.map((c) => (
                    <li key={c.label} className={`flex items-center gap-1.5 font-lp-mono text-[11.5px] ${c.passed ? "text-app-success" : "text-app-rose"}`}>
                      {c.passed ? "✓" : "✗"} {c.label}
                    </li>
                  ))}
                </ul>
              )}
              {feedback.passed && feedback.nextAvailableAt && (
                <p className="mt-2 font-lp-body text-[13px] text-app-charcoal">
                  Added to your portfolio as verified {attempt.area.name} evidence. Next task in <Countdown target={feedback.nextAvailableAt} onDone={noop} />.
                </p>
              )}
              {feedback.passed && (
                <button type="button" onClick={() => onClose(true)} className="mt-3 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white">
                  Back to Arena
                </button>
              )}
            </div>
          )}
          {error && <p className="rounded-lg bg-app-rose-container px-4 py-2.5 font-lp-body text-[13px] text-app-rose">{error}</p>}
          {Tool ? (
            <Tool attemptId={attempt.attemptId} content={challenge.content as never} closed={closed} submitting={submitting} onSubmit={submit} />
          ) : (
            <p className="font-lp-body text-[13px] text-app-muted">This workstation isn&apos;t available in this version of the app.</p>
          )}
        </main>
      </div>
    </div>
  );
}
