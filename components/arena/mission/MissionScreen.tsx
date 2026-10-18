"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Circle, FlaskConical, Lightbulb, RotateCcw, Trophy, X } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { Countdown } from "../workstations/Countdown";
import { DIFFICULTY_CLASS, type ChallengeDetail } from "../ChallengeSolvePanel";
import { MissionChart } from "./MissionChart";
import { MissionDiagram } from "./MissionDiagram";
import { ReadingBar, ResultTable } from "./MissionReadings";
import { EXPERIMENTS_FOR_BONUS, MISSION_POINTS } from "@/lib/arena-challenges/missions/score";
import type { Control, HistoryEntry, MissionFormat, Settings } from "@/lib/arena-challenges/missions/types";
import type { MissionView } from "@/lib/arena-challenges/missions/service";

const FORMAT_LABEL: Record<MissionFormat, string> = { simulation: "Interactive simulation", lab: "Virtual lab", puzzle: "Engineering puzzle", decision: "Decision game" };
const isActive = (c: Control, settings: Settings) => !c.when || String(settings[c.when.id]) === c.when.value;
const defaults = (controls: Control[]): Settings => Object.fromEntries(controls.map((c) => [c.id, c.default]));

/** "Diameter 100 mm · PVC": a settings snapshot in the words of the controls. */
function describe(controls: Control[], settings: Settings): string {
  return controls
    .filter((c) => isActive(c, settings))
    .map((c) => (c.kind === "choice" ? (c.options.find((o) => o.value === String(settings[c.id]))?.label ?? String(settings[c.id])) : `${settings[c.id]}${c.unit ? ` ${c.unit}` : ""}`))
    .join(" · ");
}

function History({ entries, controls, onLoad, locked }: { entries: HistoryEntry[]; controls: Control[]; onLoad: (s: Settings) => void; locked: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--m-rule)] bg-white">
      <p className="px-3.5 pt-3 font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)]">Your experiments</p>
      <table className="mt-2 w-full min-w-[320px] border-collapse font-lp-mono text-[12px]">
        <thead><tr>{["#", "Settings", "Met", ""].map((c, i) => <th key={i} scope="col" className="border-b border-[var(--m-rule)] px-3 py-1.5 text-left font-semibold text-app-muted">{c}</th>)}</tr></thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i}>
              <td className="border-b border-[var(--m-rule)] px-3 py-1.5 text-app-muted">{i + 1}</td>
              <td className="border-b border-[var(--m-rule)] px-3 py-1.5 text-[var(--m-ink)]">{describe(controls, e.settings)}</td>
              <td className={`border-b border-[var(--m-rule)] px-3 py-1.5 font-bold ${e.met === e.total ? "text-app-success" : "text-[var(--m-ink)]"}`}>{e.met}/{e.total}</td>
              <td className="border-b border-[var(--m-rule)] px-3 py-1.5 text-right">{!locked && <button type="button" onClick={() => onLoad(e.settings)} className="font-lp-body text-[12px] font-semibold text-app-orange hover:underline">Try again</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MissionScreen({ challenge, onDone }: { challenge: ChallengeDetail; onDone: () => void }) {
  const [view, setView] = useState<MissionView | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [busy, setBusy] = useState<"test" | "hint" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt] = useState(() => new Date(Date.now() + challenge.time_limit_minutes * 60_000).toISOString());

  useEffect(() => {
    let live = true;
    fetch(`/api/arena/missions?challengeId=${challenge.id}`)
      .then(async (res) => ({ ok: res.ok, body: await res.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (!live) return;
        if (!ok) return setError(typeof body.error === "string" ? body.error : "Could not open this mission.");
        setView(body as MissionView);
        setSettings((body as MissionView).settings);
      })
      .catch(() => live && setError("Could not open this mission. Check your connection."));
    return () => {
      live = false;
    };
  }, [challenge.id]);

  const act = useCallback(
    async (action: "test" | "hint") => {
      setBusy(action);
      setError(null);
      try {
        const res = await fetch("/api/arena/missions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: challenge.id, action, settings }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) setError(typeof body.error === "string" ? body.error : "Something went wrong. Try again.");
        else setView(body as MissionView);
      } catch {
        setError("Could not reach the server. Try again.");
      } finally {
        setBusy(null);
      }
    },
    [challenge.id, settings]
  );

  if (!view) {
    return error ? (
      <div className="rounded-xl border border-[var(--m-rule)] bg-white p-8 text-center">
        <p role="alert" className="font-lp-body text-[13.5px] text-app-rose">{error}</p>
        <button type="button" onClick={onDone} className="mt-4 font-lp-body text-[13px] font-semibold text-app-orange hover:underline">Back to challenges</button>
      </div>
    ) : (
      <div className="flex justify-center py-16"><ThinkingOrb state="connecting" size={64} theme="light" /></div>
    );
  }

  const results = new Map((view.outcome?.objectives ?? []).map((o) => [o.id, o]));
  const maxPoints = MISSION_POINTS[challenge.difficulty];
  const done = view.passed;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onDone} className="mr-1 flex items-center gap-1.5 font-lp-body text-[13px] text-app-muted hover:text-[var(--m-ink)]"><ArrowLeft size={14} />Challenges</button>
        <span className={`rounded-full px-2.5 py-0.5 font-lp-mono text-[10.5px] font-semibold ${DIFFICULTY_CLASS[challenge.difficulty]}`}>{challenge.difficulty}</span>
        <span className="rounded-full bg-app-blue-container px-2.5 py-0.5 font-lp-mono text-[10.5px] font-semibold text-app-blue">{FORMAT_LABEL[view.lab.format]}</span>
        <span className="font-lp-mono text-[10.5px] text-app-muted">{view.lab.topic}</span>
        {!done && <span className="ml-auto flex items-center gap-3 font-lp-mono text-[11.5px] font-semibold text-[var(--m-ink)]"><Countdown target={expiresAt} onDone={onDone} /><span className="rounded-full bg-white px-2.5 py-0.5 text-app-orange">up to +{maxPoints + Math.round(maxPoints * 0.2)} pts</span></span>}
      </div>

      <h2 className="mt-3 font-lp-display text-[24px] font-bold leading-tight text-[var(--m-ink)]">{challenge.title}</h2>
      <p className="mt-2 max-w-3xl font-lp-body text-[14px] leading-relaxed text-app-muted">{challenge.scenario}</p>

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {view.given.map((g) => (
          <div key={g.label} className="rounded-lg border border-[var(--m-rule)] bg-white px-3.5 py-2">
            <dt className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">{g.label}</dt>
            <dd className="font-lp-body text-[13px] text-[var(--m-ink)]">{g.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label={view.lab.name} className="space-y-4">
          <div className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
            <div className="flex items-center gap-2"><FlaskConical size={16} className="text-app-orange" aria-hidden /><h3 className="font-lp-display text-[16px] font-bold text-[var(--m-ink)]">{view.lab.name}</h3></div>
            {view.scene && <div className="mt-3"><MissionDiagram scene={view.scene} /></div>}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {view.controls.filter((c) => isActive(c, settings)).map((c) => (
                <div key={c.id}>
                  <label htmlFor={`ctl-${c.id}`} className="flex items-baseline justify-between font-lp-body text-[12.5px] font-semibold text-app-muted">
                    {c.label}
                    {c.kind === "number" && <output htmlFor={`ctl-${c.id}`} className="font-lp-mono text-[13px] text-[var(--m-ink)]">{String(settings[c.id])}{c.unit ? ` ${c.unit}` : ""}</output>}
                  </label>
                  {c.kind === "choice" ? (
                    <select id={`ctl-${c.id}`} value={String(settings[c.id])} disabled={done} onChange={(e) => setSettings({ ...settings, [c.id]: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[var(--m-rule)] bg-white px-3 py-2 font-lp-body text-[13.5px] text-[var(--m-ink)] focus:outline-none focus:ring-2 focus:ring-app-charcoal/20 disabled:opacity-60">
                      {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input id={`ctl-${c.id}`} type="range" min={c.min} max={c.max} step={c.step} value={Number(settings[c.id])} disabled={done} onChange={(e) => setSettings({ ...settings, [c.id]: Number(e.target.value) })} className="mt-2.5 w-full accent-app-orange disabled:opacity-60" />
                  )}
                </div>
              ))}
            </div>
            {!done && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => act("test")} disabled={busy !== null} className="rounded-lg bg-app-charcoal px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white disabled:opacity-60">{busy === "test" ? "Testing…" : "Run test"}</button>
                <button type="button" onClick={() => act("hint")} disabled={busy !== null || view.hintsUsed >= view.maxHints} className="flex items-center gap-1.5 rounded-lg border border-[var(--m-rule)] px-4 py-2.5 font-lp-body text-[13px] font-semibold text-[var(--m-ink)] disabled:opacity-50"><Lightbulb size={14} aria-hidden />{view.hintsUsed >= view.maxHints ? "No hints left" : `Hint (${view.hintsUsed}/${view.maxHints}, −15% points)`}</button>
                <button type="button" onClick={() => setSettings(defaults(view.controls))} disabled={busy !== null} className="flex items-center gap-1.5 px-2 py-2.5 font-lp-body text-[12.5px] text-app-muted hover:text-[var(--m-ink)]"><RotateCcw size={13} aria-hidden />Reset</button>
              </div>
            )}
            {error && <p role="alert" className="mt-3 font-lp-body text-[12.5px] font-semibold text-app-rose">{error}</p>}
          </div>

          <div aria-live="polite" className="space-y-4">
            {view.outcome ? (
              <>
                {view.outcome.readings.length > 0 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{view.outcome.readings.map((r) => <ReadingBar key={r.id} r={r} />)}</div>}
                {view.outcome.table && <ResultTable table={view.outcome.table} />}
                {view.outcome.series && <MissionChart series={view.outcome.series} />}
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--m-rule)] bg-white px-4 py-8 text-center font-lp-body text-[13px] text-app-muted">Set the controls and run a test. Nothing is judged until you do, and you can test as many times as you like.</p>
            )}
          </div>

          {view.history.length > 1 && <History entries={view.history} controls={view.controls} locked={done} onLoad={setSettings} />}

          {done && (
            <div className="rounded-xl border border-app-success/40 bg-app-success-container p-5">
              <p className="flex items-center gap-2 font-lp-display text-[18px] font-bold text-[var(--m-ink)]"><Trophy size={18} className="text-app-success" aria-hidden />Mission complete{view.score ? ` · +${view.score.total} points` : ""}</p>
              {view.score && (
                <p className="mt-1 font-lp-mono text-[11.5px] text-app-muted">
                  {view.score.base} base{view.hintsUsed > 0 ? ` × ${Math.round(view.score.hintFactor * 100)}% (${view.hintsUsed} hint${view.hintsUsed > 1 ? "s" : ""})` : ""}{view.score.bonus > 0 ? ` + ${view.score.bonus} for testing ${view.distinctRuns} different settings` : ""}
                </p>
              )}
              {view.explanation && (<><h4 className="mt-4 font-lp-body text-[13px] font-bold text-[var(--m-ink)]">What you discovered</h4><p className="mt-1 font-lp-body text-[13.5px] leading-relaxed text-[var(--m-ink)]">{view.explanation}</p></>)}
              <button type="button" onClick={onDone} className="mt-4 rounded-lg bg-app-charcoal px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white">Back to challenges</button>
            </div>
          )}
        </section>

        <aside aria-label="Mission" className="space-y-4">
          <div className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
            <h3 className="font-lp-display text-[15px] font-bold text-[var(--m-ink)]">Mission</h3>
            <p className="mt-1 font-lp-body text-[13px] leading-relaxed text-app-muted">{view.mission}</p>
            <ul className="mt-3 space-y-2">
              {view.requirements.map((r) => {
                const o = results.get(r.id);
                return (
                  <li key={r.id} className="flex gap-2">
                    {o ? (o.ok ? <Check size={15} className="mt-0.5 shrink-0 text-app-success" aria-label="met" /> : <X size={15} className="mt-0.5 shrink-0 text-app-rose" aria-label="not met" />) : <Circle size={15} className="mt-0.5 shrink-0 text-app-muted" aria-label="not tested yet" />}
                    <span className="font-lp-body text-[13px] text-[var(--m-ink)]">{r.label}{o && <span className="block font-lp-mono text-[11.5px] text-app-muted">{o.detail}</span>}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
            <h3 className="font-lp-display text-[15px] font-bold text-[var(--m-ink)]">Your bench</h3>
            <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">{view.lab.tools.join(" · ")}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["Tests", view.runs], ["Different", view.distinctRuns], ["Hints", `${view.hintsUsed}/${view.maxHints}`]].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg bg-app-background py-2"><dd className="font-lp-mono text-[15px] font-bold text-[var(--m-ink)]">{v}</dd><dt className="font-lp-body text-[11px] text-app-muted">{k}</dt></div>
              ))}
            </dl>
            <p className="mt-3 font-lp-body text-[11.5px] leading-relaxed text-app-muted"><span className="font-semibold">Educational model.</span> {view.lab.assumptions}</p>
            {!done && <p className="mt-3 font-lp-body text-[11.5px] leading-relaxed text-app-muted">Try at least {EXPERIMENTS_FOR_BONUS} different settings for a 20% experimenter bonus. Points go to your Stream score only.</p>}
          </div>

          {view.hintLog.length > 0 && (
            <div className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
              <h3 className="font-lp-display text-[15px] font-bold text-[var(--m-ink)]">Hints</h3>
              <ol className="mt-2 space-y-2">{view.hintLog.map((h, i) => <li key={i} className="font-lp-body text-[13px] leading-relaxed text-[var(--m-ink)]"><span className="mr-1.5 font-lp-mono text-[11px] font-bold text-app-orange">{i + 1}</span>{h}</li>)}</ol>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
