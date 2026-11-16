"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { validateJob } from "@/lib/professional/jobs";
import type { WorkEntry } from "@/lib/professional/work";

const FIELD = "w-full rounded-xl border border-[var(--m-soft)] bg-white px-3.5 py-2.5 text-[14.5px] text-[var(--m-ink)] placeholder:text-[var(--m-off)] focus:border-[var(--m-ink)] focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] font-bold text-[var(--m-ink)]";

/** The jobs on a professional's profile, with a form to add one and a button to remove one. */
export function JobsEditor({ jobs, maxMonth }: { jobs: WorkEntry[]; maxMonth: string }) {
  const id = useId();
  const router = useRouter();
  const [employerName, setEmployer] = useState("");
  const [jobTitle, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [current, setCurrent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const call = async (url: string, init: RequestInit) => {
    const res = await fetch(url, init);
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "That did not save. Try again.");
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { employerName, jobTitle, start, end, current };
    const check = validateJob(body);
    if (!check.ok) return setMsg(check.error);
    setBusy(true);
    setMsg(null);
    try {
      await call("/api/professional/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setEmployer(""); setTitle(""); setStart(""); setEnd(""); setCurrent(false);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "That did not save. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (jobId: string) => {
    try {
      await call(`/api/professional/jobs/${jobId}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "That did not delete. Try again.");
    }
  };

  return (
    <div>
      {jobs.length === 0 ? <p className="text-[14px] text-[var(--m-muted)]">No jobs yet. Add one below, or upload your resume on the Overview page.</p> : (
        <ul className="divide-y divide-[var(--m-rule)]">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0"><p className="text-[15px] font-bold text-[var(--m-ink)]">{j.title}</p><p className="text-[14px] text-[var(--m-ink)]">{j.organisation}{j.current ? " · current" : ""}</p><p className="text-[13px] tabular-nums text-[var(--m-muted)]">{j.period}</p></div>
              <button type="button" onClick={() => remove(j.id)} aria-label={`Remove ${j.title} at ${j.organisation}`} className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--m-muted)] hover:bg-[var(--m-ground)] hover:text-[var(--m-ink)] focus-visible:outline-2 focus-visible:outline-[var(--m-accent)]"><Trash2 size={16} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-5 grid gap-4 border-t border-[var(--m-rule)] pt-5">
        <p className="text-[14px] font-bold text-[var(--m-ink)]">Add a job</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor={`${id}-e`} className={LABEL}>Employer</label><input id={`${id}-e`} className={FIELD} value={employerName} maxLength={120} onChange={(e) => setEmployer(e.target.value)} /></div>
          <div><label htmlFor={`${id}-t`} className={LABEL}>Job title</label><input id={`${id}-t`} className={FIELD} value={jobTitle} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><label htmlFor={`${id}-s`} className={LABEL}>Started</label><input id={`${id}-s`} type="month" className={FIELD} value={start} max={maxMonth} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label htmlFor={`${id}-n`} className={LABEL}>Left</label><input id={`${id}-n`} type="month" className={FIELD} value={end} max={maxMonth} min={start || undefined} disabled={current} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <label className="flex items-center gap-2 text-[14px] text-[var(--m-ink)]"><input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="size-4 accent-[var(--m-ink)]" />This is my current job</label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--m-accent-ink)] disabled:opacity-45">{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}Add job</button>
          <p role="status" className="text-[13.5px] text-[var(--m-muted)]">{msg}</p>
        </div>
      </form>
    </div>
  );
}
