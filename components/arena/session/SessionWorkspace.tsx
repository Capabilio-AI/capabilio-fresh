"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { WorkstationShell, type PublicAttempt } from "../workstations/WorkstationShell";
import { ExplainWork } from "../domain/ExplainWork";
import { ReportView } from "./ReportView";
import type { SessionView } from "@/lib/arena-roles/session/service";

interface State {
  available: boolean;
  session: SessionView | null;
  anchorAttempt: PublicAttempt | null;
  latestFinishedSessionId: string | null;
}

const BOX = "rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-8";
const PRIMARY = "inline-flex items-center gap-2 rounded-full bg-app-orange px-6 py-3 font-lp-body text-[14px] font-semibold text-white transition-colors hover:bg-[#e64e00] disabled:opacity-60";

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

async function post(url: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { error: "Could not reach the server. Check your connection." } };
  }
}

/**
 * The Proof Session: a connected piece of work in stages. Renders nothing for a role that has no session. Each stage opens the ordinary workstation;
 * once every stage is passed the student explains the whole session, and then reads the report.
 */
export function SessionWorkspace() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [open, setOpen] = useState<PublicAttempt | null>(null);

  const load = useCallback(() => fetch("/api/arena/sessions").then((r) => r.json()).then(setState).catch(() => setState({ available: false, session: null, anchorAttempt: null, latestFinishedSessionId: null })), []);
  useEffect(() => {
    load();
  }, [load]);

  if (!state || !state.available) return null;
  const { session } = state;

  const start = async () => {
    setBusy(true);
    setError(null);
    const r = await post("/api/arena/sessions");
    setBusy(false);
    if (!r.ok) return setError(String(r.data.error ?? "Could not start the session."));
    await load();
  };

  const openStage = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    // the plan is only counted (words), never stored
    if (countWords(plan) > 0) await post(`/api/arena/sessions/${session.session.id}/events`, { kind: "plan_note", words: countWords(plan) });
    await post(`/api/arena/sessions/${session.session.id}/events`, { kind: "brief_viewed" });
    const r = await post(`/api/arena/sessions/${session.session.id}/stage`);
    setBusy(false);
    if (!r.ok) return setError(String(r.data.error ?? "Could not open this stage."));
    setPlan("");
    setOpen((r.data as { attempt: PublicAttempt }).attempt);
  };

  if (!session) {
    return (
      <section className={`${BOX} mb-6`} aria-label="Proof Session">
        <h3 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Proof Session</h3>
        <p className="mt-1 max-w-xl font-lp-body text-[13.5px] leading-relaxed text-app-muted">
          One connected piece of work in five stages, on your own company data: prepare the data, answer the business question, cross-check the number, report it, and explain what is behind it. About an hour or two. You explain your work at the end.
        </p>
        {error && <p className="mt-3 font-lp-body text-[13px] text-app-rose">{error}</p>}
        <button type="button" onClick={start} disabled={busy} className={`${PRIMARY} mt-4`}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
          Start a Proof Session
        </button>
        {state.latestFinishedSessionId && (
          <div className="mt-6">
            <ReportView sessionId={state.latestFinishedSessionId} />
          </div>
        )}
      </section>
    );
  }

  const current = session.stages.find((s) => s.stageKey === session.current) ?? null;
  return (
    <section className={`${BOX} mb-6`} aria-label="Proof Session in progress">
      <h3 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Proof Session in progress</h3>
      <ol className="mt-4 flex flex-col gap-2">
        {session.stages.map((s) => (
          <li key={s.stageKey} className="flex items-start gap-2.5 font-lp-body text-[13.5px]">
            {s.status === "passed" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-app-success" /> : <Circle size={16} className={`mt-0.5 shrink-0 ${s.stageKey === session.current ? "text-app-orange" : "text-app-muted"}`} />}
            <span>
              <span className={`font-semibold ${s.stageKey === session.current ? "text-[var(--m-ink)]" : "text-app-muted"}`}>{s.title}</span>
              {s.stageKey === session.current && <span className="block text-app-muted">{s.goal}</span>}
            </span>
          </li>
        ))}
      </ol>

      {error && <p className="mt-3 font-lp-body text-[13px] text-app-rose">{error}</p>}

      {current && (
        <div className="mt-5">
          <label className="block font-lp-body text-[13px] font-semibold text-[var(--m-ink)]" htmlFor="stage-plan">
            Before you start: how will you approach this stage? <span className="font-normal text-app-muted">(optional; only the length is recorded, not what you write)</span>
          </label>
          <textarea id="stage-plan" value={plan} onChange={(e) => setPlan(e.target.value)} rows={2} maxLength={600} className="mt-1.5 w-full rounded-lg border border-[var(--m-rule)] px-3 py-2 font-lp-body text-[13.5px]" />
          <button type="button" onClick={openStage} disabled={busy} className={`${PRIMARY} mt-3`}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            Open this stage
          </button>
        </div>
      )}

      {!current && state.anchorAttempt && (
        <div className="mt-6">
          <p className="mb-3 font-lp-body text-[13.5px] text-[var(--m-ink)]">Every stage is passed. Explain your work to finish the session and earn your ratings.</p>
          <ExplainWork attempt={state.anchorAttempt} onDone={load} />
        </div>
      )}

      {open && (
        <WorkstationShell
          attempt={open}
          onClose={() => {
            setOpen(null);
            load();
          }}
        />
      )}
    </section>
  );
}
