"use client";

import { useActionState, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import clsx from "clsx";
import { PLANS, type PlanId } from "@/lib/plans/catalog";
import { selectPlan, type SelectPlanState } from "@/app/(app)/plans/actions";

/** Choose or change a plan. `current` is the saved plan (null on the first visit straight after login). */
export function PlanPicker({ current }: { current: PlanId | null }) {
  const [state, action, pending] = useActionState<SelectPlanState, FormData>(selectPlan, {});
  const [picked, setPicked] = useState<PlanId | null>(current);

  return (
    <section className="mx-auto max-w-5xl py-6" aria-labelledby="plans-h">
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--m-accent-soft)] px-3 py-1 text-[12px] font-bold text-[var(--m-accent-ink)]"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Early access</p>
        <h1 id="plans-h" className="mt-3 font-lp-display text-[32px] font-bold leading-tight tracking-tight text-[var(--m-ink)] sm:text-[44px]">{current ? "Your plan" : "Choose your plan"}</h1>
        <p className="mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--m-muted)]">
          Pick how you want to go after your first role. You are not charged during early access, and you can change plan any time.
        </p>
      </div>

      <form action={action} className="mt-8">
        <fieldset>
          <legend className="sr-only">Plans</legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const on = picked === plan.id;
              return (
                <label
                  key={plan.id}
                  className={clsx(
                    "glass relative flex cursor-pointer flex-col gap-4 rounded-3xl p-6 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--m-accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                    on && "ring-2 ring-[var(--m-ink)]"
                  )}
                >
                  <input type="radio" name="plan" value={plan.id} checked={on} onChange={() => setPicked(plan.id)} className="sr-only" />
                  {plan.highlight && <span className="absolute -top-3 left-6 rounded-full bg-[var(--m-accent)] px-3 py-1 text-[11.5px] font-bold text-white">{plan.highlight}</span>}
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">{plan.name}</h2>
                    <span aria-hidden className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", on ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-[var(--m-soft)]")}>{on && <Check className="h-3.5 w-3.5" />}</span>
                  </div>
                  <p className="font-lp-display text-[34px] font-bold leading-none text-[var(--m-ink)]">
                    {plan.price}
                    {plan.cadence && <span className="ml-1.5 font-lp-body text-[13px] font-semibold text-[var(--m-muted)]">{plan.cadence}</span>}
                  </p>
                  <p className="text-[14px] leading-relaxed text-[var(--m-muted)]">{plan.blurb}</p>
                  <ul className="mt-auto flex flex-col gap-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13.5px] text-[var(--m-ink)]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--m-accent)]" aria-hidden />{f}</li>
                    ))}
                  </ul>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-col items-center gap-2">
          <button type="submit" disabled={!picked || pending} className="inline-flex min-w-48 items-center justify-center rounded-full bg-[var(--m-ink)] px-7 py-3 text-[14.5px] font-bold text-white shadow-[0_12px_24px_-12px_rgb(20_20_20/0.75)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
            {pending ? "Saving…" : current ? "Save plan" : "Continue"}
          </button>
          <p role="alert" className="min-h-5 text-[13px] font-semibold text-red-600">{state.error}</p>
        </div>
      </form>
    </section>
  );
}
