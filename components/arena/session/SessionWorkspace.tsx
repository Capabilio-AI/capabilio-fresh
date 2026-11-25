"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Loader2, Lock } from "lucide-react";
import { WorkstationShell, type PublicAttempt } from "../workstations/WorkstationShell";
import { ExplainWork } from "../domain/ExplainWork";
import { ReportView } from "./ReportView";
import type { LadderLevel, SessionView } from "@/lib/arena-roles/session/service";

interface State {
  available: boolean;
  spec?: { title: string; intro: string };
  /** a role with a path of levels: every level and where the student stands */
  ladder?: LadderLevel[] | null;
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
    return { ok: false, data: { error: "Could not reach the server. Check your connection.", network: true } };
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

  const start = async (specKey?: string) => {
    setBusy(true);
    setError(null);
    const r = await post("/api/arena/sessions", specKey ? { specKey } : undefined);
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
    // a stage can take a minute or more to prepare, and a slow connection may give up first; opening it again returns the same stage
    if (!r.ok) return setError(r.data.network ? "Your stage is taking a while to prepare. Wait a moment, then open it again." : String(r.data.error ?? "Could not open this stage."));
    setPlan("");
    setOpen((r.data as { attempt: PublicAttempt }).attempt);
  };

  if (!session && state.ladder) {
    const open = state.ladder.find((l) => l.status === "open") ?? null;
    return (
      <section className={`${BOX} mb-6`} aria-label="Your path">
        <h3 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Your path to job-ready</h3>
        <p className="mt-1 max-w-xl font-lp-body text-[13.5px] leading-relaxed text-app-muted">Four levels, opened one after another. Each is a connected piece of the job on your own company data. Passing one proves its skills in your portfolio and opens the next.</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {state.ladder.map((l) => (
            <li key={l.specKey} className={`flex flex-col gap-2 rounded-2xl border p-4 ${l.status === "done" ? "border-[#17784a] bg-[#e8f5ee]" : l.status === "open" ? "border-[var(--m-ink)]" : "border-[var(--m-rule)] bg-[var(--m-ground)] text-app-muted"}`}>
              <p className="flex items-center justify-between font-lp-body text-[12px] font-bold uppercase tracking-wide opacity-70"><span>Level {l.level}</span><span>{l.status === "done" ? "Proven" : l.status === "open" ? "Open" : "Locked"}</span></p>
              <p className="font-lp-display text-[17px] font-bold leading-tight text-[var(--m-ink)]">{l.title.replace(/^Level \d: /, "")}</p>
              {l.status === "open" && <p className="font-lp-body text-[13px] leading-relaxed text-[var(--m-ink)]">{l.intro}</p>}
              {l.status === "locked" && <p className="inline-flex items-center gap-1.5 font-lp-body text-[13px]"><Lock size={13} aria-hidden />Opens when Level {l.level - 1} is proven</p>}
              {l.status === "done" && <p className="inline-flex items-center gap-1.5 font-lp-body text-[13px] font-bold text-[#0f5132]"><CheckCircle2 size={14} aria-hidden />Badge earned</p>}
            </li>
          ))}
        </ol>
        {error && <p className="mt-3 font-lp-body text-[13px] text-app-rose">{error}</p>}
        {open ? (
          <button type="button" onClick={() => start(open.specKey)} disabled={busy} className={`${PRIMARY} mt-4`}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            Start Level {open.level}
          </button>
        ) : <p className="mt-4 font-lp-body text-[14px] font-bold text-[#0f5132]">You have proven every level of this path.</p>}
        {state.latestFinishedSessionId && (
          <div className="mt-6">
            <ReportView sessionId={state.latestFinishedSessionId} />
          </div>
        )}
      </section>
    );
  }

  if (!session) {
    return (
      <section className={`${BOX} mb-6`} aria-label="Proof Session">
        <h3 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Proof Session</h3>
        <p className="mt-1 max-w-xl font-lp-body text-[13.5px] leading-relaxed text-app-muted">
          {state.spec?.intro}
        </p>
        {error && <p className="mt-3 font-lp-body text-[13px] text-app-rose">{error}</p>}
        <button type="button" onClick={() => start()} disabled={busy} className={`${PRIMARY} mt-4`}>
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
