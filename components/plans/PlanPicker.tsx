"use client";

import { useActionState, useState } from "react";
import { ENFORCE_PLANS, PLANS, type PlanId } from "@/lib/plans/catalog";
import { PlanCards } from "@/components/plans/PlanCards";
import { selectPlan, type SelectPlanState } from "@/app/(app)/plans/actions";

/** Choose or change a plan. `current` is the saved plan (null on the first visit straight after login). */
export function PlanPicker({ current }: { current: PlanId | null }) {
  const [state, action, pending] = useActionState<SelectPlanState, FormData>(selectPlan, {});
  const [picked, setPicked] = useState<PlanId | null>(current);

  return (
    <section className="mx-auto max-w-5xl py-6" aria-labelledby="plans-h">
      <div className="text-center">
        <h1 id="plans-h" className="font-lp-display text-[32px] font-bold leading-tight tracking-tight text-[var(--m-ink)] sm:text-[44px]">{current ? "Your plan" : "Pick the plan that fits your job hunt"}</h1>
        <p className="mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--m-muted)]">
          Pick how you want to go after your first role. You are not charged during early access, and you can change plan any time.
          {!ENFORCE_PLANS && " Every feature, including AI Interview, is open on every plan for now."}
        </p>
      </div>

      <form action={action} className="mt-10">
        <PlanCards picked={picked} onPick={setPicked} />

        <div className="mt-6 flex flex-col items-center gap-2">
          <button type="submit" disabled={!picked || pending} className="inline-flex min-w-48 items-center justify-center rounded-full bg-[var(--m-ink)] px-7 py-3 text-[14.5px] font-bold text-white shadow-[0_12px_24px_-12px_rgb(20_20_20/0.75)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
            {pending ? "Saving…" : picked ? `${current ? "Save" : "Continue with"} ${PLANS.find((p) => p.id === picked)?.name}` : "Pick a plan"}
          </button>
          <p role="alert" className="min-h-5 text-[13px] font-semibold text-red-600">{state.error}</p>
        </div>
      </form>
    </section>
  );
}
