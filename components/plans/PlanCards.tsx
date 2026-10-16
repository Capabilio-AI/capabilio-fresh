"use client";

import { Check, Minus } from "lucide-react";
import clsx from "clsx";
import { PLANS, type Plan, type PlanId } from "@/lib/plans/catalog";

/** The three plan cards as one radio group. Controlled: the parent owns which plan is picked. */
export function PlanCards({ picked, onPick }: { picked: PlanId | null; onPick: (id: PlanId) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Plans</legend>
      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3 md:gap-4 lg:gap-6">
        {PLANS.map((plan, i) => (
          <PlanCard key={plan.id} plan={plan} index={i} on={picked === plan.id} onPick={() => onPick(plan.id)} />
        ))}
      </div>
    </fieldset>
  );
}

function PlanCard({ plan, index, on, onPick }: { plan: Plan; index: number; on: boolean; onPick: () => void }) {
  const dark = plan.id === "elite";
  const featured = plan.id === "pro";
  const ink = dark ? "text-white" : "text-[var(--m-ink)]";
  const sub = dark ? "text-white/70" : "text-[var(--m-muted)]";

  return (
    <label
      style={{ "--i": index } as React.CSSProperties}
      className={clsx(
        "plan-rise relative flex cursor-pointer flex-col rounded-[1.75rem] p-6 transition-[transform,box-shadow] duration-300 ease-out has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--m-accent-ink)] hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-7",
        dark ? "bg-[var(--m-ink)] shadow-[0_24px_40px_-24px_rgb(20_20_20/0.7)]" : "bg-[var(--m-sheet)] shadow-[0_14px_30px_-18px_rgb(20_20_20/0.35)]",
        featured && "md:-my-3 md:py-9",
        on ? "ring-[3px] ring-[var(--m-accent)] ring-offset-2 ring-offset-[var(--m-ground)]" : dark ? "" : "ring-1 ring-[var(--m-rule)]",
        featured && !on && "ring-2 ring-[var(--m-accent)]"
      )}
    >
      <input type="radio" name="plan" value={plan.id} checked={on} onChange={onPick} className="sr-only" />

      {plan.highlight && (
        <span className="absolute -top-3 left-7 rounded-full bg-[var(--m-accent)] px-3.5 py-1 text-[12px] font-bold text-white shadow-[0_6px_14px_-6px_rgb(194_65_12/0.8)]">{plan.highlight}</span>
      )}

      <div className="flex items-start justify-between gap-3">
        <h2 className={clsx("font-lp-display text-[22px] font-bold tracking-tight", ink)}>{plan.name}</h2>
        <span
          aria-hidden
          className={clsx(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
            on ? "border-[var(--m-accent)] bg-[var(--m-accent)] text-white" : dark ? "border-white/35" : "border-[var(--m-soft)]"
          )}
        >
          {on && <Check className="h-4 w-4" strokeWidth={3} />}
        </span>
      </div>

      <p className={clsx("mt-5 font-lp-display text-[44px] font-bold leading-none tracking-tight", ink)}>
        {plan.price}
        {plan.cadence && <span className={clsx("ml-2 font-lp-body text-[14px] font-semibold tracking-normal", sub)}>{plan.cadence}</span>}
      </p>
      <p className={clsx("mt-2 min-h-5 text-[13px] font-semibold", sub)}>{plan.hint}</p>
      <p className={clsx("mt-2 min-h-[3.25rem] text-[14px] leading-relaxed", sub)}>{plan.blurb}</p>

      <dl className={clsx("mt-5 flex flex-col divide-y border-t", dark ? "divide-white/12 border-white/15" : "divide-[var(--m-rule)] border-[var(--m-rule)]")}>
        {plan.rows.map((r) => (
          <div key={r.label} className="flex items-start gap-3 py-3">
            <span
              aria-hidden
              className={clsx(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                r.included ? "bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]" : dark ? "bg-white/10 text-white/50" : "bg-[var(--m-ground)] text-[var(--m-off)]"
              )}
            >
              {r.included ? <Check className="h-3 w-3" strokeWidth={3} /> : <Minus className="h-3 w-3" strokeWidth={3} />}
            </span>
            <div className="min-w-0">
              <dt className={clsx("text-[12px] font-semibold", sub)}>{r.label}</dt>
              <dd className={clsx("text-[14px] leading-snug", r.included ? clsx("font-bold", ink) : sub)}>
                {r.value}
                {r.soon && <span className={clsx("ml-2 rounded-full px-2 py-0.5 align-middle text-[10.5px] font-bold", dark ? "bg-white/15 text-white/80" : "bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]")}>Soon</span>}
              </dd>
            </div>
          </div>
        ))}
      </dl>

      {plan.note && <p className={clsx("mt-auto rounded-2xl px-4 py-3 text-[13px] leading-snug", dark ? "bg-white/10 text-white/80" : "bg-[var(--m-ground)] text-[var(--m-muted)]")}>{plan.note}</p>}
    </label>
  );
}
