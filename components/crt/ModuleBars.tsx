import { CRT_MODULES, MODULE_LABEL, type ModuleScores } from "@/lib/crt/model";
import { modulePct } from "@/lib/crt/score";

/** The four module scores as labelled bars. A module that was not part of the attempt is left out. */
export function ModuleBars({ scores }: { scores: ModuleScores }) {
  return (
    <ul className="flex flex-col gap-3">
      {CRT_MODULES.filter((m) => scores[m].max > 0).map((m) => {
        const pct = modulePct(scores[m]);
        return (
          <li key={m}>
            <div className="mb-1 flex items-baseline justify-between font-lp-body text-[13px]">
              <span className="font-semibold text-app-charcoal">{MODULE_LABEL[m]}</span>
              <span className="tabular-nums text-app-muted">{pct}%</span>
            </div>
            <div role="meter" aria-label={MODULE_LABEL[m]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-[var(--m-accent-soft)]">
              <div className={`h-full rounded-full ${pct >= 60 ? "bg-app-success" : pct >= 40 ? "bg-[var(--m-accent)]" : "bg-app-orange"}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
