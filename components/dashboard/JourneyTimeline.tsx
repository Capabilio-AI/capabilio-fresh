import clsx from "clsx";
import { JOURNEY_STAGES, stageState } from "@/lib/journey/stage";

/** The student's journey as one line: stops passed are filled, the current stop is ringed. */
export function JourneyTimeline({ year }: { year: number | null }) {
  return (
    <section aria-labelledby="journey-h" className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
      <h2 id="journey-h" className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Your journey</h2>
      <ol className="relative mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-7">
        <span aria-hidden className="absolute left-0 right-0 top-[13px] hidden h-[5px] rounded-full bg-[var(--m-ink)] lg:block" />
        {JOURNEY_STAGES.map((stage, i) => {
          const state = stageState(stage, year);
          const done = state === "done";
          const active = state === "active";
          return (
            <li key={stage.key} className="relative flex flex-col items-center gap-2 text-center" aria-current={active ? "step" : undefined}>
              <span className={clsx("relative z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full border-[4px] border-[var(--m-ink)] text-[12px] font-bold", done ? "bg-[var(--m-ink)] text-white" : "bg-white text-[var(--m-ink)]", active && "shadow-[0_0_0_4px_#e3eefb]")}>
                {done ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 7.3l2.7 2.7L11 4.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg> : i + 1}
              </span>
              <span className={clsx("text-[12.5px]", active ? "font-bold text-[var(--m-ink)]" : "font-bold text-[var(--m-muted)]")}>{stage.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
