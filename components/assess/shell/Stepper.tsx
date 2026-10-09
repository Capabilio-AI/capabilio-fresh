import { Check } from "lucide-react";
import type { Stage } from "./AssessScope";

export const STEPS: { stage: Stage; label: string }[] = [
  { stage: "role", label: "Role" },
  { stage: "common", label: "Common" },
  { stage: "career", label: "Career" },
  { stage: "results", label: "Results" },
];

/** Four rooms in order. Completed steps are checked, the current one is lit; the compact form shows "Step n of 4". */
export function Stepper({ current }: { current: Stage }) {
  const at = STEPS.findIndex((s) => s.stage === current);
  return (
    <>
      <ol className="hidden items-center gap-1 md:flex" aria-label="Assessment progress">
        {STEPS.map((s, i) => {
          const done = i < at;
          const active = i === at;
          return (
            <li key={s.stage} className="flex items-center gap-1" aria-current={active ? "step" : undefined}>
              <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors duration-300 ${active ? "bg-[var(--m-ink)] text-white shadow-[0_8px_16px_-8px_rgb(23_19_31/0.7)]" : done ? "text-[var(--m-ink)]" : "text-[var(--m-off)]"}`}>
                <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10.5px] ${active ? "bg-white/20" : done ? "bg-[var(--ok)] text-white" : "border border-[var(--m-soft)]"}`} aria-hidden>
                  {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                {s.label}
                {done && <span className="sr-only"> (done)</span>}
              </span>
              {i < STEPS.length - 1 && <span aria-hidden className={`h-px w-4 ${i < at ? "bg-[var(--ok)]" : "bg-[var(--m-soft)]"}`} />}
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] font-bold text-[var(--m-muted)] md:hidden" aria-label={`Step ${at + 1} of ${STEPS.length}`}>
        Step {at + 1} of {STEPS.length} · <span className="text-[var(--m-ink)]">{STEPS[at].label}</span>
      </p>
    </>
  );
}
