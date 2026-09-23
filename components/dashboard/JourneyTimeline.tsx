import { Check } from "lucide-react";
import clsx from "clsx";
import { JOURNEY_STAGES, currentStageIndex } from "@/lib/journey/stage";

export function JourneyTimeline({ year }: { year: string | null }) {
  const activeIndex = currentStageIndex(year);

  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Your journey</h2>
      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-7">
        {JOURNEY_STAGES.map((stage, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <div key={stage.key} className="flex flex-col items-center gap-2 text-center">
              <span
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full font-lp-mono text-[11px] font-semibold",
                  done && "bg-app-success text-white",
                  active && "bg-app-orange text-white ring-4 ring-app-orange-container",
                  !done && !active && "bg-app-background text-app-muted"
                )}
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
              <span
                className={clsx(
                  "font-lp-body text-[11.5px] font-medium",
                  active ? "text-app-charcoal" : "text-app-muted"
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
