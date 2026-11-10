"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, PlayCircle } from "lucide-react";
import { BAND_LABEL, CRT_MODULES, QUESTIONS_PER_MODULE } from "@/lib/crt/model";
import { modulePct } from "@/lib/crt/score";
import type { SimTestKey } from "@/lib/crt/categories";
import type { RunnerPayload, StudentCycle } from "@/lib/crt/server";
import type { StudioView } from "@/lib/crt/studio-server";
import { MODULE_LABEL } from "@/lib/crt/model";
import { CrtRunner } from "./CrtRunner";
import { ModuleBars } from "./ModuleBars";
import { SimulatorExam } from "./SimulatorExam";
import { SpeakingStudio } from "./SpeakingStudio";
import { ReadinessRadar, Simulator } from "./StudioSections";
import { crtPost, formatWhen } from "./api";

const CARD = "rounded-2xl border border-app-border bg-white p-5 sm:p-6";
const H2 = "font-lp-display text-[20px] font-bold text-app-charcoal";

function Assessment({ cycle, onStart, busy, error }: { cycle: StudentCycle | undefined; onStart: (id: string) => void; busy: boolean; error: string | null }) {
  if (!cycle) {
    return (
      <section className={CARD} aria-label="Assessment">
        <h2 className={H2}>Your CRT assessment</h2>
        <p className="mt-2 max-w-[60ch] font-lp-body text-[14px] text-app-muted">Your placement cell has not opened an assessment for you. When it does, it appears here and you are notified. You can sharpen up in the Placement Simulator below in the meantime.</p>
      </section>
    );
  }
  const closed = cycle.status === "closed" && !cycle.result;
  const resumable = cycle.inProgress && cycle.status === "open";
  return (
    <section className={CARD} aria-label="Assessment">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted"><CalendarClock size={13} aria-hidden /> {formatWhen(cycle.opensAt)} to {formatWhen(cycle.closesAt)}</p>
          <h2 className={`${H2} mt-1`}>{cycle.title}</h2>
          <p className="mt-2 max-w-[62ch] font-lp-body text-[14px] text-app-muted">
            {cycle.canStart && !cycle.inProgress && `${CRT_MODULES.length * QUESTIONS_PER_MODULE} questions across aptitude, reasoning, communication and soft skills. One minute per question, ${cycle.durationMinutes} minutes in all. You can take it once, until ${formatWhen(cycle.closesAt)}.`}
            {resumable && "You have started this assessment. Pick up where you left off while the clock is still running."}
            {closed && "This assessment has closed and you did not complete it."}
            {cycle.result && "You have completed this assessment."}
          </p>
          {(cycle.canStart || resumable) && <p className="mt-2 max-w-[62ch] font-lp-body text-[12.5px] text-app-muted">Your placement cell will see your score for this assessment.</p>}
          {error && <p role="alert" className="mt-3 font-lp-body text-[13px] text-app-warning">{error}</p>}
        </div>
        {(cycle.canStart || resumable) && (
          <button type="button" onClick={() => onStart(cycle.id)} disabled={busy} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-3 font-lp-body text-[14px] font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <PlayCircle size={16} aria-hidden />}
            {cycle.inProgress ? "Resume assessment" : "Start assessment"}
          </button>
        )}
      </div>
    </section>
  );
}

function Results({ cycles }: { cycles: StudentCycle[] }) {
  const done = cycles.filter((c) => c.result);
  const latest = done[0];
  if (!latest?.result) return null;
  const r = latest.result;
  const weakest = CRT_MODULES.filter((m) => r.moduleScores[m].max > 0).sort((a, b) => modulePct(r.moduleScores[a]) - modulePct(r.moduleScores[b]))[0];
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
          {weakest && <p className="mt-4 font-lp-body text-[13px] text-app-muted">Your weakest area was <strong className="text-app-charcoal">{MODULE_LABEL[weakest].toLowerCase()}</strong>. Take that section&apos;s test in the simulator below.</p>}
        </div>
        {trend.length > 1 && (
          <div className="basis-60">
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
    </section>
  );
}

/** The CRT area inside SkillStudio: the placement cell's assessment, the placement simulator, and readiness. */
export function CrtHome({ cycles, view, autoStart }: { cycles: StudentCycle[]; view: StudioView; autoStart: string | null }) {
  const router = useRouter();
  const [runner, setRunner] = useState<RunnerPayload | null>(null);
  const [test, setTest] = useState<SimTestKey | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auto = useRef(autoStart);

  const current = cycles.find((c) => c.canStart || (c.inProgress && c.status === "open")) ?? cycles[0];

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
      <Assessment cycle={current} onStart={start} busy={busy} error={error} />
      <Results cycles={cycles} />
      <Simulator view={view} onStart={setTest} onSpeaking={() => setSpeaking(true)} />
      <ReadinessRadar view={view} />
      {test && <SimulatorExam test={test} onClose={() => { setTest(null); router.refresh(); }} />}
      {speaking && <SpeakingStudio recent={view.speaking.recent} onClose={() => { setSpeaking(false); router.refresh(); }} />}
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
