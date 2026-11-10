"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, ChevronRight, Loader2, PlayCircle } from "lucide-react";
import { BAND_LABEL, CRT_MODULES, MODULE_LABEL, QUESTIONS_PER_MODULE, type CrtModule } from "@/lib/crt/model";
import { modulePct } from "@/lib/crt/score";
import type { RunnerPayload, SessionCard, StudentCycle } from "@/lib/crt/server";
import { CrtRunner } from "./CrtRunner";
import { ModuleBars } from "./ModuleBars";
import { SessionDrawer } from "./SessionDrawer";
import { crtPost, formatDay } from "./api";

const CARD = "rounded-2xl border border-app-border bg-white p-5 sm:p-6";
const H2 = "font-lp-display text-[20px] font-bold text-app-charcoal";

function CurrentCycle({ cycle, onStart, busy, error }: { cycle: StudentCycle | undefined; onStart: (id: string) => void; busy: boolean; error: string | null }) {
  if (!cycle) {
    return (
      <section className={CARD} aria-label="Assessment">
        <h2 className={H2}>Your CRT assessment</h2>
        <p className="mt-2 max-w-[60ch] font-lp-body text-[14px] text-app-muted">Your placement cell has not opened a CRT cycle yet. When it does, you will be told here and in your notifications. The training sessions below are open to you now.</p>
      </section>
    );
  }
  const upcoming = cycle.status === "upcoming";
  const closed = cycle.status === "closed" && !cycle.result;
  return (
    <section className={CARD} aria-label="Assessment">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted"><CalendarClock size={13} aria-hidden /> {formatDay(cycle.opensOn)} to {formatDay(cycle.closesOn)}</p>
          <h2 className={`${H2} mt-1`}>{cycle.title}</h2>
          <p className="mt-2 max-w-[60ch] font-lp-body text-[14px] text-app-muted">
            {upcoming && `Opens on ${formatDay(cycle.opensOn)}.`}
            {cycle.canStart && !cycle.inProgress && `${CRT_MODULES.length * QUESTIONS_PER_MODULE} questions across aptitude, reasoning, communication and soft skills, ${cycle.durationMinutes} minutes. The clock starts when you begin and you can take it once.`}
            {cycle.inProgress && cycle.status !== "closed" && "You have started this assessment. Pick up where you left off while the clock is still running."}
            {closed && "This cycle has closed and you did not complete it."}
            {cycle.result && "You have completed this assessment."}
          </p>
          {(cycle.canStart || cycle.inProgress) && <p className="mt-2 max-w-[60ch] font-lp-body text-[12.5px] text-app-muted">Your placement cell will see your score for this assessment.</p>}
          {error && <p role="alert" className="mt-3 font-lp-body text-[13px] text-app-orange">{error}</p>}
        </div>
        {(cycle.canStart || (cycle.inProgress && cycle.status === "open")) && (
          <button type="button" onClick={() => onStart(cycle.id)} disabled={busy} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-3 font-lp-body text-[14px] font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <PlayCircle size={16} aria-hidden />}
            {cycle.inProgress ? "Resume assessment" : "Start assessment"}
          </button>
        )}
      </div>
    </section>
  );
}

function Results({ cycles, sessions, onOpen }: { cycles: StudentCycle[]; sessions: SessionCard[]; onOpen: (id: string) => void }) {
  const done = cycles.filter((c) => c.result);
  const latest = done[0];
  if (!latest?.result) return null;
  const r = latest.result;
  const weakest = CRT_MODULES.filter((m) => r.moduleScores[m].max > 0).sort((a, b) => modulePct(r.moduleScores[a]) - modulePct(r.moduleScores[b]))[0];
  const next = weakest ? sessions.find((s) => s.module === weakest && !s.done) : undefined;
  const trend = [...done].reverse();
  return (
    <section className={CARD} aria-label="Your results">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1 basis-72">
          <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">Latest result · {latest.title}</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="font-lp-display text-[48px] font-bold leading-none tabular-nums text-app-charcoal">{r.totalPct}%</span>
            <span className="mb-1 rounded-full bg-[var(--m-accent-soft)] px-3 py-1 font-lp-body text-[12.5px] font-bold text-[var(--m-ink)]">{BAND_LABEL[r.band]}</span>
          </div>
          <div className="mt-5 max-w-md"><ModuleBars scores={r.moduleScores} /></div>
        </div>
        <div className="flex basis-60 flex-col gap-4">
          {next && weakest && (
            <button type="button" onClick={() => onOpen(next.id)} className="flex items-center justify-between gap-3 rounded-xl border border-app-border p-4 text-left hover:bg-[var(--m-accent-soft)]">
              <span>
                <span className="block font-lp-body text-[11px] font-bold uppercase tracking-wide text-app-orange">Work on next</span>
                <span className="mt-0.5 block font-lp-body text-[14px] font-semibold text-app-charcoal">{next.title}</span>
                <span className="block font-lp-body text-[12.5px] text-app-muted">Your weakest area was {MODULE_LABEL[weakest].toLowerCase()}.</span>
              </span>
              <ChevronRight size={18} aria-hidden className="shrink-0 text-app-muted" />
            </button>
          )}
          {trend.length > 1 && (
            <div>
              <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">Across cycles</p>
              <ol className="mt-2 flex items-end gap-2" aria-label="Score in each cycle">
                {trend.map((c) => (
                  <li key={c.id} className="flex flex-1 flex-col items-center gap-1" title={`${c.title}: ${c.result!.totalPct}%`}>
                    <span className="font-lp-body text-[11.5px] tabular-nums text-app-muted">{c.result!.totalPct}%</span>
                    <span className="w-full rounded-t-md bg-[var(--m-accent)]" style={{ height: `${Math.max(6, c.result!.totalPct * 0.6)}px` }} />
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Training({ sessions, onOpen }: { sessions: SessionCard[]; onOpen: (id: string) => void }) {
  const byModule = useMemo(() => CRT_MODULES.map((m) => ({ module: m, items: sessions.filter((s) => s.module === m) })).filter((g) => g.items.length > 0), [sessions]);
  if (byModule.length === 0) return null;
  return (
    <section aria-label="Training sessions">
      <h2 className={`${H2} mb-3`}>Training sessions</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {byModule.map(({ module, items }) => {
          const finished = items.filter((s) => s.done).length;
          return (
            <div key={module} className={CARD}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-lp-body text-[15px] font-bold text-app-charcoal">{MODULE_LABEL[module as CrtModule]}</h3>
                <span className="font-lp-body text-[12.5px] tabular-nums text-app-muted">{finished} of {items.length} done</span>
              </div>
              <ul className="mt-3 flex flex-col divide-y divide-app-border">
                {items.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center gap-3 py-3 text-left">
                      {s.done ? <CheckCircle2 size={18} aria-label="Completed" className="shrink-0 text-app-success" /> : <span aria-hidden className="h-[18px] w-[18px] shrink-0 rounded-full border border-app-border" />}
                      <span className="min-w-0 flex-1">
                        <span className="block font-lp-body text-[14px] font-semibold text-app-charcoal">{s.title}</span>
                        <span className="block font-lp-body text-[12.5px] text-app-muted">{s.minutes} min · {s.summary}</span>
                      </span>
                      <ChevronRight size={16} aria-hidden className="shrink-0 text-app-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** The CRT area inside SkillStudio: the current assessment, your results, and the training sessions. */
export function CrtHome({ cycles, sessions, autoStart }: { cycles: StudentCycle[]; sessions: SessionCard[]; autoStart: string | null }) {
  const router = useRouter();
  const [runner, setRunner] = useState<RunnerPayload | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auto = useRef(autoStart);

  const current = cycles.find((c) => c.canStart || (c.inProgress && c.status === "open")) ?? cycles.find((c) => c.status === "upcoming") ?? cycles[0];

  async function start(cycleId: string) {
    setBusy(true);
    setError(null);
    try {
      const out = await crtPost<{ payload: RunnerPayload }>({ action: "start", cycleId });
      setRunner(out.payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the assessment.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // arriving from the Dashboard card goes straight to the assessment
  useEffect(() => {
    const id = auto.current;
    auto.current = null;
    if (id && cycles.some((c) => c.id === id && (c.canStart || c.inProgress))) void start(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <CurrentCycle cycle={current} onStart={start} busy={busy} error={error} />
      <Results cycles={cycles} sessions={sessions} onOpen={setOpenId} />
      <Training sessions={sessions} onOpen={setOpenId} />
      {openId && <SessionDrawer sessionId={openId} onClose={() => setOpenId(null)} />}
      {runner && (
        <CrtRunner
          payload={runner}
          onClose={() => {
            setRunner(null);
            router.replace("/skillstudio/crt");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
