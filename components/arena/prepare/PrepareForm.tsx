"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { planFromText, type PrepareState } from "@/app/(app)/arena/prepare/actions";
import type { PreparationView } from "@/lib/launchpad/prepare-server";
import { PreparationPlan } from "./PreparationPlan";

const FIELD = "w-full rounded-xl border border-[var(--m-rule)] bg-white px-4 py-3 font-lp-body text-[14px] text-[var(--m-ink)] outline-none focus:border-[var(--m-ink)] focus:ring-2 focus:ring-[var(--m-accent)]/25";

/** Paste a job description to get a preparation plan. `initial` is the plan for a listed job, shown first when the page was opened from one. */
export function PrepareForm({ initial, notFound }: { initial: PreparationView | null; notFound: boolean }) {
  const [state, action, pending] = useActionState<PrepareState, FormData>(planFromText, {});
  const view = state.view ?? initial;

  return (
    <div className="flex flex-col gap-6">
      {notFound && <p role="alert" className="rounded-2xl bg-[var(--m-accent-soft)] px-4 py-3 font-lp-body text-[14px] font-semibold text-[var(--m-accent-ink)]">That listing is no longer open. Paste the job description below instead.</p>}
      {view && <PreparationPlan view={view} />}

      <form action={action} className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-8">
        <h2 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">{view ? "Prepare for a different job" : "Paste the job you want"}</h2>
        <p className="mt-1 max-w-2xl font-lp-body text-[13.5px] leading-relaxed text-app-muted">
          We find the skills in the text, compare them with what you have been measured on, and show what to practise. The text is used once and not stored.
        </p>
        <label className="mt-4 block text-[13px] font-bold text-[var(--m-ink)]">
          Job title and company <span className="font-normal text-[var(--m-muted)]">(optional)</span>
          <input name="title" maxLength={120} placeholder="Data Analyst, Acme Retail" className={`${FIELD} mt-1.5`} />
        </label>
        <label className="mt-4 block text-[13px] font-bold text-[var(--m-ink)]">
          Job description
          <textarea name="text" required rows={8} maxLength={8000} placeholder="Paste the requirements or the whole posting…" className={`${FIELD} mt-1.5 resize-y`} />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-6 py-3 text-[14px] font-bold text-white transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0">
            {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {pending ? "Reading the job…" : "Build my preparation"}
          </button>
          <p role="alert" className="min-h-5 font-lp-body text-[13px] font-semibold text-red-600">{state.error}</p>
        </div>
      </form>
    </div>
  );
}
