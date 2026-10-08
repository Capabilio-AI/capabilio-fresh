"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Clock, Code2, Loader2, Lock, Trophy } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { ELO_BY_DIFFICULTY } from "@/lib/arena-workstations/types";
import { Countdown } from "../workstations/Countdown";
import { WorkstationShell, type PublicAttempt } from "../workstations/WorkstationShell";

interface AreaProgress {
  key: string;
  name: string;
  toolType: string;
  enabled: boolean;
  disabledReason: string | null;
  verifiedCount: number;
}

type DomainState = {
  role: { key: string; label: string; parentSkill: string };
  statedRole: string | null;
  progress: AreaProgress[];
  cycle: { number: number; served: string[] } | null;
} & ({ state: "not_started" } | { state: "ready" } | { state: "unavailable" } | { state: "active"; attempt: PublicAttempt } | { state: "cooldown"; nextAvailableAt: string });

export function DomainWorkspace() {
  const [data, setData] = useState<DomainState | null>(null);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState(false);

  const apply = useCallback(
    (res: Response) =>
      res.json().then((body) => {
        if (res.ok) {
          setError(null);
          setData(body);
          return body as DomainState;
        }
        setError({ message: body.error ?? "Something went wrong.", retryable: Boolean(body.retryable) || res.status >= 500 });
        return null;
      }),
    []
  );

  const start = useCallback(() => {
    setStarting(true);
    return fetch("/api/arena/domain/attempts", { method: "POST" })
      .then(apply)
      .catch(() => setError({ message: "Could not reach the server — check your connection.", retryable: true }))
      .finally(() => setStarting(false));
  }, [apply]);

  // "ready" means a task is due: the server picks the skill area and generates it.
  const load = useCallback(
    () =>
      fetch("/api/arena/domain")
        .then(apply)
        .then((body) => {
          if (body?.state === "ready") return start();
        })
        .catch(() => setError({ message: "Could not reach the server — check your connection.", retryable: true })),
    [apply, start]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (!data && !error) {
    return (
      <div className="flex justify-center py-16">
        <ThinkingOrb state="connecting" size={64} theme="light" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {data && (
        <div className="mb-5">
          <h2 className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">{data.role.label} Workstation</h2>
          <p className="mt-1 font-lp-body text-[13px] text-app-muted">
            One real work task a day. Each day&apos;s task uses a different {data.role.parentSkill.toLowerCase()} skill and tool — every skill comes up once before any repeats.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.progress.map((p) => {
              const servedThisCycle = data.cycle?.served.includes(p.key);
              return (
                <span
                  key={p.key}
                  title={p.enabled ? undefined : p.disabledReason ?? "Coming soon"}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-lp-body text-[12px] ${p.enabled ? (p.verifiedCount > 0 ? "border-app-success/30 bg-app-success-container text-app-success" : servedThisCycle ? "border-[var(--m-rule)] bg-white text-[var(--m-ink)]" : "border-[var(--m-rule)] bg-white text-app-muted") : "border-dashed border-[var(--m-rule)] text-app-muted"}`}
                >
                  {!p.enabled ? <Lock size={11} /> : p.verifiedCount > 0 ? <CheckCircle2 size={12} /> : null}
                  {p.name}
                  {p.enabled ? (p.verifiedCount > 0 ? ` · ${p.verifiedCount} verified` : "") : " · coming soon"}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-[var(--m-rule)] bg-white px-6 py-10 text-center">
          <p className="font-lp-body text-[13.5px] text-[var(--m-ink)]">{error.message}</p>
          {error.retryable && (
            <button type="button" onClick={() => (data?.state === "ready" ? start() : load())} disabled={starting} className="mt-4 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60">
              Try again
            </button>
          )}
        </div>
      )}

      {!error && data?.state === "not_started" && (
        <div className="rounded-2xl border border-[var(--m-rule)] bg-white p-6">
          {data.statedRole && (
            <p className="font-lp-body text-[13px] text-app-muted">
              Your target role is <span className="font-semibold text-[var(--m-ink)]">{data.statedRole}</span>. A workstation for it is on the way.
            </p>
          )}
          <p className="mt-2 font-lp-body text-[14px] text-[var(--m-ink)]">
            The {data.role.label} workstation is live: a new task every day from a stakeholder at a company, using the real tools of the job, graded automatically.
          </p>
          <button type="button" onClick={start} disabled={starting} className="mt-5 flex items-center gap-1.5 rounded-lg bg-app-charcoal px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white disabled:opacity-60">
            {starting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            Start as a {data.role.label}
          </button>
        </div>
      )}

      {!error && (data?.state === "ready" || starting) && data?.state !== "active" && (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-3xl border border-[#E0E0E0] bg-white p-10 text-center">
          <ThinkingOrb state="composing" size={64} theme="light" aria-label="Generating today's task" />
          <p className="font-lp-body text-[15px] font-medium text-[#202124]">Preparing today&apos;s task…</p>
          <p className="max-w-sm font-lp-body text-[13px] text-app-muted">Generating a fresh scenario and dataset, then checking it can be graded correctly. This usually takes 10–30 seconds.</p>
        </div>
      )}

      {!error && data?.state === "active" && (
        <article className="flex min-h-[350px] flex-col gap-6 rounded-3xl border border-[#E0E0E0] bg-white p-6 sm:p-10">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-lp-body text-[15px] font-medium text-[#5F6368]">
              <Code2 size={20} strokeWidth={1.5} />
              Today&apos;s Mission
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-[#F1F3F4] px-3.5 py-1.5 font-lp-body text-[15px] font-semibold text-[#202124]">
              <Trophy size={16} strokeWidth={2.5} className="text-app-orange" />+{ELO_BY_DIFFICULTY[data.attempt.challenge.difficulty as "easy" | "medium" | "hard"] ?? ELO_BY_DIFFICULTY.easy} ELO
            </span>
          </div>
          <div>
            <h3 className="font-lp-body text-[26px] font-normal leading-tight tracking-[-0.02em] text-[#202124] sm:text-[32px]">{data.attempt.challenge.title}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-3 font-lp-body text-[15px] font-medium text-[#5F6368]">
              {data.attempt.challenge.content.company && <span className="rounded-full bg-[#F1F3F4] px-3 py-1 text-[14px] font-semibold text-[#202124]">{data.attempt.challenge.content.company}</span>}
              <span className="text-[#DADCE0]">•</span>
              <span>{data.attempt.area.name}</span>
              <span className="text-[#DADCE0]">•</span>
              <span>est. {data.attempt.challenge.time_limit_minutes} min</span>
            </div>
          </div>
          <p className="max-w-[90%] font-lp-body text-[16px] leading-[1.6] text-[#3C4043]">
            <span className="font-semibold text-[#202124]">{data.attempt.challenge.requester?.split("·")[0].trim()}:</span> {data.attempt.challenge.scenario}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-app-orange px-6 py-3 font-lp-body text-[15px] font-semibold text-white transition-colors hover:bg-[#e64e00]">
              Solve in Workspace
              <ArrowRight size={18} strokeWidth={2} />
            </button>
            <Link href="/skillstudio" className="inline-flex items-center gap-2 rounded-full border border-[#DADCE0] px-6 py-3 font-lp-body text-[15px] font-semibold text-[#3C4043] transition-colors hover:bg-[#F1F3F4]">
              <BookOpen size={18} strokeWidth={1.5} />
              Learn First
            </Link>
          </div>
        </article>
      )}

      {!error && data?.state === "cooldown" && (
        <div className="rounded-2xl border border-[var(--m-rule)] bg-white px-6 py-10 text-center">
          <Clock size={26} className="mx-auto text-app-blue" />
          <p className="mt-3 font-lp-body text-[13.5px] text-app-muted">Task verified. Your next task arrives in</p>
          <p className="mt-1 font-lp-display text-[40px] font-bold text-[var(--m-ink)]">
            <Countdown target={data.nextAvailableAt} onDone={load} />
          </p>
          <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">A new task unlocks 24 hours after you complete the previous one.</p>
        </div>
      )}

      {!error && data?.state === "unavailable" && (
        <div className="rounded-2xl border border-[var(--m-rule)] bg-white px-6 py-10 text-center font-lp-body text-[13.5px] text-app-muted">No skill areas are enabled for this role yet.</div>
      )}

      {open && data?.state === "active" && (
        <WorkstationShell
          attempt={data.attempt}
          onClose={(closed) => {
            setOpen(false);
            if (closed) load();
          }}
        />
      )}
    </div>
  );
}
