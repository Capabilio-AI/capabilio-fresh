import Link from "next/link";
import { Check } from "lucide-react";
import { currentStep, type PipelineStep } from "@/lib/graduate/pipeline";
import type { GraduateHomeData } from "@/lib/graduate/home";

/** The route from a starting point to a signed offer, each station lit only when real data says it is done. */
export function HuntRoute({ steps, applications }: { steps: PipelineStep[]; applications: GraduateHomeData["applications"] }) {
  const now = currentStep(steps);
  const total = applications.submitted + applications.shortlisted + applications.accepted + applications.rejected;
  return (
    <section aria-labelledby="route-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <h2 id="route-h" className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Your route to the first offer</h2>
      <ol className="mt-4">
        {steps.map((s, i) => {
          const live = now?.key === s.key;
          return (
            <li key={s.key} className="relative pl-10">
              {i < steps.length - 1 && <span aria-hidden className={`absolute left-[13px] top-7 h-[calc(100%-4px)] w-[2px] ${s.done ? "bg-[var(--m-accent)]" : "bg-[var(--m-rule)]"}`} />}
              <span aria-hidden className={`absolute left-0 top-0.5 grid h-[28px] w-[28px] place-items-center rounded-full border-2 text-[12px] font-bold ${s.done ? "border-[var(--m-accent)] bg-[var(--m-accent)] text-white" : live ? "border-[var(--m-ink)] bg-white text-[var(--m-ink)]" : "border-[var(--m-rule)] bg-white text-[var(--m-off)]"}`}>
                {s.done ? <Check size={14} aria-hidden /> : i + 1}
              </span>
              <Link href={s.href} aria-current={live ? "step" : undefined} className="block rounded-lg pb-5 outline-offset-4 hover:underline">
                <span className={`block font-lp-body text-[14.5px] font-bold ${live || s.done ? "text-[var(--m-ink)]" : "text-[var(--m-muted)]"}`}>{s.label}{s.done && <span className="sr-only"> (done)</span>}{live && <span className="sr-only"> (you are here)</span>}</span>
                <span className="block font-lp-body text-[12.5px] text-[var(--m-muted)]">{s.detail}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      {total > 0 && (
        <p className="border-t border-[var(--m-rule)]! pt-3 font-lp-body text-[13px] text-[var(--m-muted)]">
          Applications: <span className="font-bold text-[var(--m-ink)]">{applications.submitted} sent</span> · {applications.shortlisted} shortlisted · {applications.accepted} {applications.accepted === 1 ? "offer" : "offers"}{applications.rejected ? ` · ${applications.rejected} closed` : ""}
        </p>
      )}
    </section>
  );
}
