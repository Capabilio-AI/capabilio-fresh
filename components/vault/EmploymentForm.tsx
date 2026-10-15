"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { addEmployment, type EmploymentFormState } from "@/app/(app)/dashboard/vault/actions";

const FIELD = "w-full rounded-xl border border-[var(--m-rule)] bg-white px-3.5 py-2.5 text-[14px] text-[var(--m-ink)] outline-none focus:border-[var(--m-ink)] focus:ring-2 focus:ring-[var(--m-accent)]/30 disabled:bg-[var(--m-ground)] disabled:opacity-60";
const LABEL = "flex flex-col gap-1.5 text-[12.5px] font-bold text-[var(--m-muted)]";

/** Add a job. Ticking "I work here now" is what moves a recently graduated profile to the professional path. */
export function EmploymentForm({ movesPath }: { movesPath: boolean }) {
  const [state, action, pending] = useActionState<EmploymentFormState, FormData>(addEmployment, {});
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-[var(--m-ink)] hover:bg-[var(--m-ground)]">
        <Plus size={14} aria-hidden /> Add a job
      </button>
    );
  }
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-5 sm:grid-cols-2">
      <label className={LABEL}>Company<input name="employerName" required maxLength={120} autoComplete="organization" className={FIELD} /></label>
      <label className={LABEL}>Job title<input name="jobTitle" required maxLength={120} autoComplete="organization-title" className={FIELD} /></label>
      <label className={LABEL}>Start date <span className="font-normal">(optional)</span><input name="startDate" type="date" className={FIELD} /></label>
      <label className={LABEL}>End date<input name="endDate" type="date" disabled={current} required={!current} className={FIELD} /></label>
      <label className="flex items-center gap-2 text-[13.5px] font-bold text-[var(--m-ink)] sm:col-span-2">
        <input name="current" type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="h-4 w-4 accent-[var(--m-ink)]" />
        I work here now
      </label>
      {current && movesPath && <p className="text-[13px] text-app-muted sm:col-span-2">Saving a current job moves your profile to the professional path. Your vault and education come with you.</p>}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60">{pending ? "Saving…" : "Save job"}</button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-[13px] font-bold text-[var(--m-muted)] hover:text-[var(--m-ink)]">Cancel</button>
        <p role="alert" className="text-[12.5px] font-semibold text-red-600">{state.error}</p>
        {state.saved && !state.error && <p role="status" className="text-[12.5px] font-semibold text-app-success">Saved.</p>}
      </div>
    </form>
  );
}
