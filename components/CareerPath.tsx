import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Reveal, SectionLabel } from "./ui";

const TRACKS = ["Data Analyst", "Platform Eng", "AI Engineer"];

const BENCHMARKS = [
  { label: "Python (Pandas / Vectorized)", value: 78, target: 85, tone: "ink" as const },
  { label: "SQL (Optimization & CTEs)", value: 64, target: 85, tone: "ochre" as const },
  { label: "Statistical Inference", value: 58, target: 80, tone: "muted" as const },
];

const BAR_COLOR: Record<string, string> = {
  ink: "bg-lp-text-ink",
  ochre: "bg-lp-accent-ochre",
  muted: "bg-lp-border-strong",
};

export default function CareerPath() {
  return (
    <section className="w-full border-y border-lp-border-hairline bg-lp-surface-subtle px-margin-mobile py-space-2xl md:px-margin" id="career-path">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <Reveal className="flex flex-col gap-space-md md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <SectionLabel tone="ochre">Precise Gap Diagnostics</SectionLabel>
            <h2 className="mt-1 font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink md:text-lp-headline-lg lg:text-lp-display">
              Stop guessing what to learn next.
            </h2>
            <p className="mt-2 font-lp-body text-lp-body-lg text-lp-text-muted">
              Capabilio connects your dream role directly to the specific technical milestones
              required to get there, highlighting the critical deltas recruiters look for.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {TRACKS.map((t, i) => (
              <button
                key={t}
                type="button"
                className={
                  i === 0
                    ? "rounded bg-lp-surface-card px-3 py-1.5 font-lp-body text-lp-body-sm font-medium text-lp-text-ink"
                    : "rounded bg-transparent px-3 py-1.5 font-lp-body text-lp-body-sm text-lp-text-muted hover:text-lp-text-ink"
                }
              >
                {t}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal className="rounded-xl border border-lp-border-hairline bg-lp-surface-card p-space-lg shadow-sm">
          <div className="flex flex-col items-start justify-between gap-space-sm border-b border-lp-border-hairline pb-space-md md:flex-row md:items-center">
            <div>
              <span className="font-lp-mono text-lp-label-sm uppercase text-lp-text-muted">
                Target Market Spec
              </span>
              <div className="font-lp-display text-lp-headline-md font-semibold text-lp-text-ink">
                Senior Data Analyst (FinTech / High-Growth)
              </div>
            </div>
            <div className="flex items-center gap-space-md">
              <div className="text-right">
                <span className="block font-lp-mono text-lp-label-sm text-lp-text-muted">
                  READINESS COMPLIANCE
                </span>
                <span className="font-lp-mono text-lp-headline-sm font-bold text-lp-accent-indigo">
                  68% / 100%
                </span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-lp-accent-indigo font-lp-mono font-bold text-lp-text-ink">
                68%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-space-lg pt-space-lg lg:grid-cols-3">
            <div className="flex flex-col gap-space-md">
              <span className="font-lp-mono text-lp-label-md uppercase tracking-wider text-lp-text-muted">
                Benchmark vs Market Target
              </span>
              <div className="flex flex-col gap-4">
                {BENCHMARKS.map((b) => (
                  <div key={b.label}>
                    <div className="mb-1 flex justify-between font-lp-body text-lp-body-sm">
                      <span className="font-medium text-lp-text-ink">{b.label}</span>
                      <span
                        className={`font-lp-mono ${b.tone === "ochre" ? "font-semibold text-lp-accent-ochre" : "text-lp-text-muted"}`}
                      >
                        {b.value} / {b.target} target
                      </span>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-lp-surface-subtle">
                      <div
                        className={`h-full rounded-full ${BAR_COLOR[b.tone]}`}
                        style={{ width: `${b.value}%` }}
                      />
                      <div
                        className="absolute inset-y-0 w-0.5 bg-lp-accent-ochre"
                        style={{ left: `${b.target}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded border border-lp-border-hairline bg-lp-surface p-space-sm font-lp-mono text-lp-label-sm text-lp-text-muted">
                Target baseline synthesized from 1,420 verified technical interviews at top
                engineering teams.
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-lp-border-hairline bg-lp-surface p-space-md">
              <div>
                <div className="flex items-center gap-1.5 font-lp-mono text-lp-label-sm font-bold uppercase text-lp-accent-ochre">
                  <AlertTriangle size={16} />
                  Identified Critical Blocker
                </div>
                <h3 className="mt-2 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                  SQL Window Functions &amp; GROUP BY Pipelines
                </h3>
                <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-on-surface-variant">
                  82% of technical rounds for Data Analyst test{" "}
                  <code className="rounded border border-lp-border-hairline bg-lp-surface-card px-1 py-0.5 font-lp-mono text-xs">
                    ROW_NUMBER()
                  </code>
                  ,{" "}
                  <code className="rounded border border-lp-border-hairline bg-lp-surface-card px-1 py-0.5 font-lp-mono text-xs">
                    DENSE_RANK()
                  </code>
                  , and moving average partitions. Currently unproven in student ledger.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-lp-border-hairline pt-3 font-lp-mono text-lp-label-sm">
                <span className="text-lp-text-muted">Candidate Probability Pass</span>
                <span className="font-bold text-lp-error">42% → 89% upon fix</span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-lp-border-hairline bg-lp-surface-subtle p-space-md">
              <div>
                <div className="flex items-center gap-1.5 font-lp-mono text-lp-label-sm font-bold uppercase text-lp-accent-indigo">
                  <CheckCircle2 size={16} />
                  Direct Remediation Sprint
                </div>
                <h3 className="mt-2 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                  Retail Sales Intelligence Lab
                </h3>
                <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-on-surface-variant">
                  Connect live to 2M row PostgreSQL transactions. Write queries to detect rolling
                  revenue churn by territory using complex analytic window frames.
                </p>
              </div>
              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-lp-text-ink py-2.5 font-lp-body text-lp-body-sm font-medium text-lp-surface-card transition-colors hover:bg-lp-inverse-surface">
                Start Remediation Lab
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
