"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { OUTCOMES, OUTCOME_LABEL, ROUNDS, ROUND_LABEL, insights, validateFeedback, type Outcome, type Round } from "@/lib/professional/tracker";
import type { AppRow, FeedbackRow } from "@/lib/professional/workspace-server";

const FIELD = "w-full rounded-xl border border-[var(--m-soft)] bg-white px-3.5 py-2.5 text-[14.5px] text-[var(--m-ink)] placeholder:text-[var(--m-off)] focus:border-[var(--m-ink)] focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] font-bold text-[var(--m-ink)]";
const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.ok) return null;
    return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not save. Try again.";
  } catch {
    return "Could not reach the server. Try again.";
  }
}

/** What each interviewer told you, per round, and the patterns across all of it. */
export function FeedbackLog({ apps, feedback, today }: { apps: AppRow[]; feedback: FeedbackRow[]; today: string }) {
  const id = useId();
  const router = useRouter();
  const [f, setF] = useState({ applicationId: apps[0]?.id ?? "", round: "technical" as Round, outcome: "mixed" as Outcome, wentWell: "", toImprove: "", givenOn: today });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const name = new Map(apps.map((a) => [a.id, `${a.role}, ${a.company}`]));
  const stats = insights(feedback.map((x) => ({ round: x.round, outcome: x.outcome, to_improve: x.toImprove })));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateFeedback(f);
    if (!check.ok) return setMsg(check.error);
    setBusy(true);
    const err = await send("/api/professional/feedback", "POST", f);
    setBusy(false);
    if (err) return setMsg(err);
    setF({ ...f, wentWell: "", toImprove: "" });
    setMsg(null);
    router.refresh();
  };
  const remove = async (fid: string) => {
    const err = await send(`/api/professional/feedback/${fid}`, "DELETE");
    if (err) setMsg(err);
    router.refresh();
  };

  if (apps.length === 0) return <p className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-muted)]">Add an application in the tracker first, then log what each round taught you.</p>;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <form onSubmit={add} className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-7" aria-labelledby={`${id}-h`}>
          <h2 id={`${id}-h`} className="font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">Log feedback</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor={`${id}-a`} className={LABEL}>Application</label><select id={`${id}-a`} className={FIELD} value={f.applicationId} onChange={(e) => setF({ ...f, applicationId: e.target.value })}>{apps.map((a) => <option key={a.id} value={a.id}>{a.role}, {a.company}</option>)}</select></div>
            <div><label htmlFor={`${id}-r`} className={LABEL}>Round</label><select id={`${id}-r`} className={FIELD} value={f.round} onChange={(e) => setF({ ...f, round: e.target.value as Round })}>{ROUNDS.map((r) => <option key={r} value={r}>{ROUND_LABEL[r]}</option>)}</select></div>
            <div><label htmlFor={`${id}-o`} className={LABEL}>How did it go?</label><select id={`${id}-o`} className={FIELD} value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value as Outcome })}>{OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}</select></div>
            <div><label htmlFor={`${id}-w`} className={LABEL}>What went well</label><textarea id={`${id}-w`} rows={3} className={`${FIELD} resize-y`} maxLength={1000} value={f.wentWell} onChange={(e) => setF({ ...f, wentWell: e.target.value })} /></div>
            <div><label htmlFor={`${id}-i`} className={LABEL}>What to improve</label><textarea id={`${id}-i`} rows={3} className={`${FIELD} resize-y`} maxLength={1000} value={f.toImprove} onChange={(e) => setF({ ...f, toImprove: e.target.value })} /></div>
            <div><label htmlFor={`${id}-d`} className={LABEL}>Date</label><input id={`${id}-d`} type="date" max={today} className={FIELD} value={f.givenOn} onChange={(e) => setF({ ...f, givenOn: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--m-accent-ink)] disabled:opacity-45">{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}Save feedback</button>
            <p role="status" className="text-[13.5px] text-[var(--m-muted)]">{msg}</p>
          </div>
        </form>

        {feedback.length === 0 ? <p className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-muted)]">No feedback logged yet.</p> : (
          <ol aria-label="Feedback, newest first" className="flex flex-col gap-3">
            {feedback.map((x) => (
              <li key={x.id} className="rounded-3xl border border-[var(--m-rule)] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-[14.5px] font-bold text-[var(--m-ink)]">{name.get(x.applicationId) ?? "Application"}</p><p className="text-[13px] text-[var(--m-muted)]">{ROUND_LABEL[x.round]} · {OUTCOME_LABEL[x.outcome]} · {DAY.format(new Date(x.givenOn))}</p></div>
                  <button type="button" onClick={() => remove(x.id)} aria-label="Remove this feedback" className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--m-muted)] hover:bg-[var(--m-ground)] hover:text-[var(--m-ink)]"><Trash2 size={15} aria-hidden /></button>
                </div>
                {x.wentWell && <p className="mt-2 text-[14px] text-[var(--m-ink)]"><span className="font-bold">Went well: </span>{x.wentWell}</p>}
                {x.toImprove && <p className="mt-1 text-[14px] text-[var(--m-ink)]"><span className="font-bold">To improve: </span>{x.toImprove}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <aside aria-labelledby={`${id}-p`} className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 lg:sticky lg:top-28">
        <h2 id={`${id}-p`} className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Patterns</h2>
        {stats.total === 0 ? <p className="mt-2 text-[13.5px] text-[var(--m-muted)]">Patterns appear after you log feedback.</p> : (
          <div className="mt-3 flex flex-col gap-5 text-[13.5px]">
            <dl className="grid grid-cols-2 gap-3">{OUTCOMES.map((o) => <div key={o}><dd className="font-lp-display text-[20px] font-bold tabular-nums text-[var(--m-ink)]">{stats.byOutcome[o]}</dd><dt className="text-[12px] text-[var(--m-muted)]">{OUTCOME_LABEL[o]}</dt></div>)}</dl>
            {stats.byRound.length > 0 && <div><h3 className="font-bold text-[var(--m-ink)]">By round</h3><ul className="mt-1.5 space-y-1">{stats.byRound.map((r) => <li key={r.round} className="flex justify-between text-[var(--m-muted)]"><span>{ROUND_LABEL[r.round]}</span><span className="tabular-nums">{r.positive} of {r.total} went well</span></li>)}</ul></div>}
            {stats.themes.length > 0 && <div><h3 className="font-bold text-[var(--m-ink)]">Keeps coming up</h3><ul className="mt-1.5 flex flex-wrap gap-1.5">{stats.themes.map((t) => <li key={t.word} className="rounded-full bg-[var(--m-ground)] px-3 py-1 text-[12.5px] font-bold text-[var(--m-ink)]">{t.word} <span className="font-medium text-[var(--m-muted)]">×{t.count}</span></li>)}</ul></div>}
          </div>
        )}
      </aside>
    </div>
  );
}
