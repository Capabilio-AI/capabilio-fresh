import { TrendingUp } from "lucide-react";
import { Reveal, SectionLabel } from "./ui";

const CONTRIBUTIONS = [
  { label: "SQL Query Optimization", value: "+4 pts" },
  { label: "Data Root-Cause Analysis", value: "+5 pts" },
  { label: "Concurrency Debugging", value: "+7 pts" },
];

export default function Arena() {
  return (
    <section className="w-full bg-lp-surface px-margin-mobile py-space-2xl md:px-margin" id="arena">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <Reveal className="flex max-w-3xl flex-col gap-space-xs">
          <SectionLabel tone="ochre">Live Competitive Crucible</SectionLabel>
          <h2 className="font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink md:text-lp-headline-lg lg:text-lp-display">
            Practice like the real world.
            <br />
            Performance should be measurable.
          </h2>
          <p className="mt-1 font-lp-body text-lp-body-lg text-lp-text-muted">
            No algorithmic trivia. Enter live simulated production incidents where you resolve
            outages, refactor slow query paths, and debug distributed systems.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
          <Reveal className="flex flex-col justify-between overflow-hidden rounded-xl border border-lp-border-hairline bg-lp-surface-card shadow-sm lg:col-span-7">
            <div>
              <div className="flex items-center justify-between border-b border-lp-border-hairline bg-lp-surface-subtle p-space-md">
                <div className="flex items-center gap-2">
                  <span className="lp-pulse h-2 w-2 animate-ping rounded-full bg-lp-accent-ochre" />
                  <span className="font-lp-mono text-lp-label-sm font-semibold uppercase text-lp-text-ink">
                    Live Outage Simulation #892
                  </span>
                </div>
                <span className="font-lp-mono text-lp-label-sm font-bold text-lp-accent-ochre">
                  TIME ELAPSED: 18m 42s
                </span>
              </div>
              <div className="flex flex-col gap-space-md p-space-lg">
                <div>
                  <span className="font-lp-mono text-lp-label-sm uppercase tracking-wider text-lp-text-muted">
                    Mission Directive
                  </span>
                  <h3 className="mt-1 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                    Weekend order cancellations spiked 420% after 9 PM. Isolate the dominant
                    cause.
                  </h3>
                  <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-on-surface-variant">
                    Query payment gateway timeout logs, examine inventory reservation locks, and
                    pinpoint whether an unindexed foreign key or third-party web hook retry
                    cascade is causing thread starvation.
                  </p>
                </div>
                <div className="rounded border border-lp-border-hairline bg-lp-surface p-space-sm font-lp-mono text-lp-label-sm">
                  <div className="mb-1 text-[11px] text-lp-text-muted">// TELEMETRY LOG TRACE</div>
                  <div className="text-lp-error">
                    [21:04:12] ERROR: Lock wait timeout exceeded; try restarting transaction
                  </div>
                  <div className="text-lp-text-muted">
                    [21:04:14] WARN: PG pool exhaustion: 98/100 active connections
                  </div>
                  <div className="text-lp-accent-indigo">
                    [21:08:44] PATCH APPLIED: CREATE INDEX CONCURRENTLY idx_orders_user_id
                  </div>
                  <div className="mt-1 font-bold text-lp-text-ink">
                    &gt; Assertion Engine Score: 88 / 100 Passed
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-lp-border-hairline bg-lp-surface-subtle p-space-md">
              <span className="font-lp-mono text-lp-label-sm text-lp-text-muted">
                Incident Resolved in 18 mins (Top 12th percentile)
              </span>
              <span className="font-lp-mono text-lp-label-sm font-bold text-lp-text-ink">HASH: 0x90a..b71</span>
            </div>
          </Reveal>

          <Reveal
            delay={0.1}
            className="flex flex-col justify-between rounded-xl border-2 border-lp-text-ink bg-lp-surface-card p-space-lg shadow-md lg:col-span-5"
          >
            <div className="flex flex-col gap-space-md">
              <div className="flex items-center justify-between border-b border-lp-border-hairline pb-space-sm">
                <span className="font-lp-mono text-lp-label-md font-bold uppercase tracking-wider text-lp-accent-indigo">
                  Dynamic Rating Delta
                </span>
                <span className="font-lp-mono text-lp-label-sm text-lp-text-muted">Glicko-2 Scaled</span>
              </div>
              <div className="flex items-baseline gap-space-md">
                <span className="font-lp-display text-lp-display-mobile font-semibold text-lp-text-ink">
                  1,300
                </span>
                <div className="flex items-center gap-1 font-lp-display text-lp-headline-sm font-semibold text-lp-accent-indigo">
                  <TrendingUp size={20} />
                  <span>+16 ELO</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 font-lp-body text-lp-body-sm">
                {CONTRIBUTIONS.map((c) => (
                  <div
                    key={c.label}
                    className="flex items-center justify-between rounded border border-lp-border-hairline bg-lp-surface p-2"
                  >
                    <span>{c.label}</span>
                    <span className="font-lp-mono font-bold text-lp-accent-indigo">{c.value}</span>
                  </div>
                ))}
              </div>
              <p className="font-lp-mono text-lp-label-sm text-lp-text-muted">
                ELO is mathematically normalized against 45,000 engineering cohort benchmarks,
                weighted by complexity, time-to-resolve, and assertion precision.
              </p>
            </div>
            <div className="mt-space-md flex items-center justify-between rounded bg-lp-surface-subtle p-space-sm font-lp-mono text-lp-label-sm text-lp-text-ink">
              <span>
                Next rank tier: <strong>Senior Specialist</strong>
              </span>
              <span className="font-bold text-lp-accent-ochre">100 ELO to unlock</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
