import Link from "next/link";
import { STEPS, type StepKey } from "@/lib/curriculum/steps";

/** Stepper: every step is a plain link (keyboard and screen-reader friendly); the current one is marked with aria-current. */
export function WizardNav({ importId, current, badges }: { importId: string; current: StepKey; badges: Partial<Record<StepKey, string>> }) {
  return (
    <nav aria-label="Curriculum review steps">
      <ol className="flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => {
          const active = s.key === current;
          return (
            <li key={s.key}>
              <Link
                href={`/org/curriculum/${importId}?step=${s.key}`}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-lp-body text-[12px] transition-colors ${active ? "border-app-orange bg-app-orange-container font-semibold text-app-charcoal" : "border-app-border text-app-muted hover:text-app-charcoal"}`}
              >
                <span className="font-lp-mono text-[10.5px]">{i + 1}</span>
                {s.label}
                {badges[s.key] && <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-lp-mono text-[10px]">{badges[s.key]}</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
