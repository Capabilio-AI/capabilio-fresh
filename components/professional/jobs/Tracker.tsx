"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { CLOSED_STAGES, OPEN_STAGES, STAGES, STAGE_LABEL, validateApplication, type Stage } from "@/lib/professional/tracker";
import type { AppRow } from "@/lib/professional/workspace-server";

const FIELD = "w-full rounded-xl border border-[var(--m-soft)] bg-white px-3.5 py-2.5 text-[14.5px] text-[var(--m-ink)] placeholder:text-[var(--m-off)] focus:border-[var(--m-ink)] focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] font-bold text-[var(--m-ink)]";
const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.ok) return null;
    return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not save. Try again.";
  } catch {
    return "Could not reach the server. Try again.";
  }
}

/** Every job you have applied for, by stage. Move one along as it moves, and keep your own notes on it. */
export function Tracker({ apps, today }: { apps: AppRow[]; today: string }) {
  const id = useId();
  const router = useRouter();
  const [f, setF] = useState({ company: "", role: "", link: "", stage: "applied" as Stage, appliedOn: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateApplication(f);
    if (!check.ok) return setMsg(check.error);
    setBusy(true);
    const err = await send("/api/professional/applications", "POST", f);
    setBusy(false);
    if (err) return setMsg(err);
    setF({ company: "", role: "", link: "", stage: "applied", appliedOn: "", notes: "" });
    setMsg(null);
    router.refresh();
  };
  const move = async (appId: string, stage: Stage) => {
    const err = await send(`/api/professional/applications/${appId}`, "PATCH", { stage });
    if (err) setMsg(err);
    router.refresh();
  };
  const remove = async (appId: string) => {
    const err = await send(`/api/professional/applications/${appId}`, "DELETE");
    if (err) setMsg(err);
    router.refresh();
  };

  const card = (a: AppRow) => (
    <li key={a.id} className="rounded-2xl border border-[var(--m-rule)] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="text-[14.5px] font-bold leading-snug text-[var(--m-ink)]">{a.role}</p><p className="text-[13px] text-[var(--m-muted)]">{a.company}{a.appliedOn ? ` · applied ${DAY.format(new Date(a.appliedOn))}` : ""}</p></div>
        <button type="button" onClick={() => remove(a.id)} aria-label={`Remove ${a.role} at ${a.company}`} className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--m-muted)] hover:bg-[var(--m-ground)] hover:text-[var(--m-ink)] focus-visible:outline-2 focus-visible:outline-[var(--m-accent)]"><Trash2 size={15} aria-hidden /></button>
      </div>
      {a.notes && <p className="mt-2 whitespace-pre-wrap break-words text-[13px] text-[var(--m-muted)]">{a.notes}</p>}
      <div className="mt-3 flex items-center gap-2">
        <label className="sr-only" htmlFor={`${id}-${a.id}`}>Stage of {a.role} at {a.company}</label>
        <select id={`${id}-${a.id}`} value={a.stage} onChange={(e) => move(a.id, e.target.value as Stage)} className="rounded-full border border-[var(--m-rule)] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[var(--m-ink)]">{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
        {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" aria-label={`Open the posting for ${a.role}`} className="grid size-8 place-items-center rounded-full text-[var(--m-muted)] hover:text-[var(--m-ink)]"><ExternalLink size={15} aria-hidden /></a>}
      </div>
    </li>
  );
  const column = (stage: Stage) => {
    const list = apps.filter((a) => a.stage === stage);
    return (
      <section key={stage} aria-label={`${STAGE_LABEL[stage]}, ${list.length}`} className="min-w-[240px] rounded-3xl bg-[var(--m-ground)] p-3">
        <h3 className="flex items-center justify-between px-2 pb-2 text-[13px] font-bold text-[var(--m-ink)]">{STAGE_LABEL[stage]}<span className="rounded-full bg-white px-2 py-0.5 text-[12px] tabular-nums text-[var(--m-muted)]">{list.length}</span></h3>
        {list.length === 0 ? <p className="px-2 pb-2 text-[12.5px] text-[var(--m-muted)]">Nothing here.</p> : <ul className="flex flex-col gap-2.5">{list.map(card)}</ul>}
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={add} className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-7" aria-labelledby={`${id}-add`}>
        <h2 id={`${id}-add`} className="font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">Track an application</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><label htmlFor={`${id}-c`} className={LABEL}>Company</label><input id={`${id}-c`} className={FIELD} value={f.company} maxLength={120} onChange={(e) => setF({ ...f, company: e.target.value })} /></div>
          <div><label htmlFor={`${id}-r`} className={LABEL}>Role</label><input id={`${id}-r`} className={FIELD} value={f.role} maxLength={120} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
          <div><label htmlFor={`${id}-s`} className={LABEL}>Stage</label><select id={`${id}-s`} className={FIELD} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value as Stage })}>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></div>
          <div><label htmlFor={`${id}-d`} className={LABEL}>Applied on</label><input id={`${id}-d`} type="date" max={today} className={FIELD} value={f.appliedOn} onChange={(e) => setF({ ...f, appliedOn: e.target.value })} /></div>
          <div className="sm:col-span-2"><label htmlFor={`${id}-l`} className={LABEL}>Link to the posting (optional)</label><input id={`${id}-l`} type="url" className={FIELD} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://" /></div>
          <div className="sm:col-span-2"><label htmlFor={`${id}-n`} className={LABEL}>Notes (optional)</label><input id={`${id}-n`} className={FIELD} value={f.notes} maxLength={2000} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Recruiter, referral, salary range" /></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--m-accent-ink)] disabled:opacity-45">{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}Add application</button>
          <p role="status" className="text-[13.5px] text-[var(--m-muted)]">{msg}</p>
        </div>
      </form>

      {apps.length === 0 ? <p className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-muted)]">Nothing tracked yet. Add the jobs you have applied for and see where each one stands.</p> : (
        <>
          <div className="-mx-1 overflow-x-auto px-1 pb-2"><div className="grid min-w-max grid-flow-col auto-cols-[260px] gap-3">{OPEN_STAGES.map(column)}</div></div>
          <details className="rounded-3xl border border-[var(--m-rule)] bg-white p-5">
            <summary className="cursor-pointer text-[14.5px] font-bold text-[var(--m-ink)]">Closed: accepted, rejected and withdrawn ({apps.filter((a) => CLOSED_STAGES.includes(a.stage)).length})</summary>
            <div className="mt-4 grid gap-3 md:grid-cols-3">{CLOSED_STAGES.map(column)}</div>
          </details>
        </>
      )}
    </div>
  );
}
