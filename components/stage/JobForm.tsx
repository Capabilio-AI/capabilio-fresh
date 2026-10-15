"use client";

import { useActionState } from "react";
import { reportJob, type StageActionState } from "@/app/(app)/settings/stage-actions";

const FIELD = "w-full rounded-xl border border-[var(--m-rule)] bg-white px-3.5 py-2.5 text-[14px] text-[var(--m-ink)] outline-none focus:border-[var(--m-ink)] focus:ring-2 focus:ring-[var(--m-accent)]/30";

/** A graduate reports their job; the profile then moves to the professional path. */
export function JobForm() {
  const [state, action, pending] = useActionState<StageActionState, FormData>(reportJob, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-[var(--m-muted)]">
        Company
        <input name="employerName" required maxLength={120} autoComplete="organization" className={FIELD} />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-[var(--m-muted)]">
        Job title
        <input name="jobTitle" required maxLength={120} autoComplete="organization-title" className={FIELD} />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-[var(--m-muted)] sm:col-span-2">
        Start date <span className="font-normal">(optional)</span>
        <input name="employedSince" type="date" className={`${FIELD} sm:max-w-56`} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60">
          {pending ? "Updating…" : "Update my profile"}
        </button>
        <p role="alert" className="text-[12.5px] font-semibold text-red-600">{state.error}</p>
      </div>
    </form>
  );
}
