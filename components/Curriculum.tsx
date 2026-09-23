import { Target, Activity, Terminal } from "lucide-react";
import { Reveal, SectionLabel } from "./ui";

const UNITS = [
  {
    state: "mastered" as const,
    title: "Python Data Foundations",
    body: "Data frames, vectorization, dictionary indexing, and list comprehensions.",
  },
  {
    state: "mastered" as const,
    title: "Pandas Matrix Operations",
    body: "Handling missing values, melt, pivot tables, and hierarchical indexes.",
  },
  {
    state: "active" as const,
    title: "Advanced SQL Window Functions",
    body: "Partitioning, lag/lead time series, running totals, and index efficiency.",
  },
  {
    state: "locked" as const,
    title: "Statistical Inference & A/B Tests",
    body: "Null hypothesis testing, p-values, power analysis, and bootstrap methods.",
    unlock: "Unlocks at SQL 75",
  },
];

export default function Curriculum() {
  return (
    <section className="w-full bg-lp-surface px-margin-mobile py-space-2xl md:px-margin">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <Reveal className="flex max-w-3xl flex-col gap-space-xs">
          <SectionLabel tone="indigo">SkillStudio Engine</SectionLabel>
          <h2 className="font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink md:text-lp-headline-lg lg:text-lp-display">
            Don&apos;t take another generic course.
            <br />
            Learn what your career path actually requires.
          </h2>
          <p className="mt-1 font-lp-body text-lp-body-lg text-lp-text-muted">
            Every concept you study is computationally justified by a project you need to build
            and a job description requirement you need to fulfill.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
          <Reveal className="flex flex-col gap-space-sm lg:col-span-7">
            {UNITS.map((u, i) => {
              if (u.state === "active") {
                return (
                  <div
                    key={u.title}
                    className="flex items-center justify-between rounded border-2 border-lp-accent-ochre bg-lp-surface-card p-space-md shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="lp-pulse flex h-7 w-7 animate-pulse items-center justify-center rounded-full bg-lp-accent-ochre font-lp-mono text-lp-label-sm font-bold text-lp-surface-card">
                        03
                      </span>
                      <div>
                        <div className="font-lp-display text-lp-headline-sm font-medium text-lp-text-ink">
                          {u.title}
                        </div>
                        <p className="font-lp-body text-lp-body-sm text-lp-on-surface-variant">{u.body}</p>
                      </div>
                    </div>
                    <span className="rounded bg-lp-surface-subtle px-2 py-0.5 font-lp-mono text-lp-label-sm font-bold uppercase text-lp-accent-ochre">
                      Active Sprint
                    </span>
                  </div>
                );
              }
              if (u.state === "locked") {
                return (
                  <div
                    key={u.title}
                    className="flex items-center justify-between rounded border border-lp-border-hairline bg-lp-surface p-space-md opacity-75"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lp-surface-subtle font-lp-mono text-lp-label-sm text-lp-text-muted">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <div className="font-lp-display text-lp-headline-sm font-medium text-lp-text-ink">
                          {u.title}
                        </div>
                        <p className="font-lp-body text-lp-body-sm text-lp-text-muted">{u.body}</p>
                      </div>
                    </div>
                    <span className="font-lp-mono text-lp-label-sm uppercase text-lp-text-muted">
                      {u.unlock}
                    </span>
                  </div>
                );
              }
              return (
                <div
                  key={u.title}
                  className="flex items-center justify-between rounded border border-lp-border-hairline bg-lp-surface-card p-space-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lp-surface-subtle font-lp-mono text-lp-label-sm font-bold text-lp-accent-indigo">
                      ✓
                    </span>
                    <div>
                      <div className="font-lp-display text-lp-headline-sm font-medium text-lp-text-ink">
                        {u.title}
                      </div>
                      <p className="font-lp-body text-lp-body-sm text-lp-text-muted">{u.body}</p>
                    </div>
                  </div>
                  <span className="font-lp-mono text-lp-label-sm uppercase text-lp-text-muted">
                    Mastered
                  </span>
                </div>
              );
            })}
          </Reveal>

          <Reveal
            delay={0.1}
            className="flex flex-col justify-between rounded-xl border border-lp-border-hairline bg-lp-surface-subtle p-space-lg lg:col-span-5"
          >
            <div className="flex flex-col gap-space-md">
              <div className="flex items-center justify-between border-b border-lp-border-hairline pb-space-sm">
                <span className="font-lp-mono text-lp-label-md uppercase tracking-wider text-lp-text-muted">
                  Embedded Reasoning Layer
                </span>
                <span className="font-lp-mono text-lp-label-sm font-medium text-lp-accent-indigo">
                  CHAIN ID: #R-883
                </span>
              </div>
              <div className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                Why am I learning this exact concept?
              </div>
              <div className="flex flex-col gap-3 font-lp-body text-lp-body-sm">
                <div className="flex items-start gap-3 rounded border border-lp-border-hairline bg-lp-surface-card p-2.5">
                  <Target size={18} className="mt-0.5 shrink-0 text-lp-accent-indigo" />
                  <div>
                    <strong className="text-lp-text-ink">Target Career:</strong>
                    <div className="text-lp-text-muted">Data Analyst @ Series B+ Tech</div>
                  </div>
                </div>
                <div className="flex items-center justify-center font-lp-mono text-xs text-lp-text-muted">
                  ↓ requires capability
                </div>
                <div className="flex items-start gap-3 rounded border border-lp-border-hairline bg-lp-surface-card p-2.5">
                  <Activity size={18} className="mt-0.5 shrink-0 text-lp-accent-ochre" />
                  <div>
                    <strong className="text-lp-text-ink">Target Benchmark:</strong>
                    <div className="text-lp-text-muted">SQL Level 85 (Currently 64 — deficit 21 pts)</div>
                  </div>
                </div>
                <div className="flex items-center justify-center font-lp-mono text-xs text-lp-text-muted">
                  ↓ verified through artifact
                </div>
                <div className="flex items-start gap-3 rounded border border-lp-border-hairline bg-lp-surface-card p-2.5">
                  <Terminal size={18} className="mt-0.5 shrink-0 text-lp-accent-indigo" />
                  <div>
                    <strong className="text-lp-text-ink">Project Requirement:</strong>
                    <div className="text-lp-text-muted">
                      Retail Sales Intelligence — Query 4 requires{" "}
                      <code className="bg-lp-surface-subtle px-1 font-lp-mono text-xs">
                        OVER (PARTITION BY)
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-space-md flex items-center justify-between rounded border border-lp-border-hairline bg-lp-surface-card p-space-sm font-lp-mono text-lp-label-sm text-lp-text-muted">
              <span>Zero fluff. Zero disconnected theory.</span>
              <span className="font-medium text-lp-accent-indigo">100% purposeful code</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
