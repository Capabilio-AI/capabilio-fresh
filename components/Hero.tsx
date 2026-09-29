"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Lock,
  Terminal,
  Timer,
} from "lucide-react";
import { Badge, PrimaryButton, SecondaryButton } from "./ui";

const SKILLS = [
  { label: "Python (Data Structures & Pandas)", value: 78, status: "verified", tone: "ink" as const },
  { label: "SQL (Relational Algebra & Opt)", value: 64, status: "pending", tone: "ochre" as const },
  { label: "Exploratory Data Analysis (EDA)", value: 71, status: "verified", tone: "ink" as const },
  { label: "Statistical Inference & Hypothesis", value: 58, status: "locked", tone: "muted" as const },
  { label: "Technical Reporting & Synthesis", value: 82, status: "verified", tone: "ink" as const },
];

const PIPELINE = [
  { step: "01 Assess" },
  { step: "02 Discover" },
  { step: "03 Learn" },
  { step: "04 Practice", active: true },
  { step: "05 Build" },
  { step: "06 Prove" },
  { step: "07 Showcase", indigo: true },
];

const STATUS_ICON = { verified: BadgeCheck, pending: Clock, locked: Lock };
const BAR_COLOR: Record<string, string> = {
  ink: "bg-lp-text-ink",
  ochre: "bg-lp-accent-ochre",
  muted: "bg-lp-border-strong",
};
const STATUS_COLOR: Record<string, string> = {
  verified: "text-lp-accent-indigo",
  pending: "text-lp-accent-ochre",
  locked: "text-lp-text-muted",
};

function WorkspaceCanvas() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-xl border border-lp-border-hairline bg-lp-surface-card shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-lp-border-hairline bg-lp-surface-subtle px-space-md py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-lp-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-lp-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-lp-border-strong" />
          <span className="ml-2 font-lp-mono text-lp-label-sm text-lp-text-muted">
            SESSION #CAP-9821 // TELEMETRY STREAM
          </span>
        </div>
        <div className="flex items-center gap-space-md font-lp-mono text-lp-label-sm">
          <span className="text-lp-text-muted">
            PROFILE: <strong className="text-lp-text-ink">ananya_rao</strong>
          </span>
          <Badge tone="indigo" dot={false}>
            TARGET: DATA ANALYST
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-lg bg-lp-surface-card p-space-lg lg:grid-cols-12">
        {/* Col A: Archetype + Readiness + Current Focus */}
        <div className="flex flex-col justify-between gap-space-md border-b border-lp-border-hairline pb-space-lg lg:col-span-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-space-lg">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-lp-mono text-lp-label-md uppercase text-lp-text-muted">
                Archetype Track
              </span>
              <Badge tone="neutral" dot={false}>
                MATCH 94.2%
              </Badge>
            </div>
            <h2 className="mt-1 font-lp-display text-lp-headline-lg font-semibold text-lp-text-ink">
              Data Analyst
            </h2>
            <p className="mt-1 font-lp-body text-lp-body-sm text-lp-text-muted">
              Cohort percentile: Top 8% · Market readiness delta: -28%
            </p>
          </div>

          <div className="grid grid-cols-2 gap-space-sm rounded border border-lp-border-hairline bg-lp-surface-subtle p-space-md">
            <div>
              <span className="font-lp-mono text-lp-label-sm uppercase text-lp-text-muted">
                Readiness
              </span>
              <div className="font-lp-display text-lp-headline-lg font-semibold text-lp-text-ink">
                72<span className="text-lp-headline-sm font-normal text-lp-text-muted">%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-lp-surface-container-high">
                <div className="h-full w-[72%] rounded-full bg-lp-accent-ochre" />
              </div>
            </div>
            <div>
              <span className="font-lp-mono text-lp-label-sm uppercase text-lp-text-muted">
                Global ELO
              </span>
              <div className="font-lp-display text-lp-headline-lg font-semibold text-lp-accent-indigo">
                1,284
              </div>
              <div className="mt-2 font-lp-mono text-lp-label-sm text-lp-text-muted">
                Class II Verified (+16 Wk)
              </div>
            </div>
          </div>

          <div className="rounded border border-lp-border-hairline bg-lp-surface p-space-md">
            <div className="mb-1 flex items-center justify-between font-lp-mono text-lp-label-sm">
              <span className="uppercase tracking-wider text-lp-text-muted">Current Focus</span>
              <span className="font-medium text-lp-accent-ochre">IN EXECUTION</span>
            </div>
            <div className="font-lp-display text-lp-headline-sm font-medium text-lp-text-ink">
              SQL Window Functions &amp; Aggregates
            </div>
            <p className="mt-1 font-lp-body text-lp-body-sm text-lp-on-surface-variant">
              Synthesizing multi-partition window frames across 1.8M e-commerce records.
            </p>
            <div className="mt-space-sm flex items-center justify-between font-lp-mono text-lp-label-sm">
              <span className="text-lp-text-muted">Estimated delta: +24 ELO</span>
              <span className="font-medium text-lp-text-ink">Step 3 of 5</span>
            </div>
          </div>
        </div>

        {/* Col B: Skill vector + sparkline */}
        <div className="flex flex-col gap-space-md border-b border-lp-border-hairline pb-space-lg lg:col-span-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-space-lg">
          <div className="flex items-center justify-between">
            <span className="font-lp-mono text-lp-label-md uppercase text-lp-text-muted">
              Empirical Skill Vector
            </span>
            <span className="font-lp-mono text-lp-label-sm text-lp-text-muted">HASH: 0x82f..991</span>
          </div>

          <div className="flex flex-col gap-space-sm">
            {SKILLS.map((s) => {
              const StatusIcon = STATUS_ICON[s.status as keyof typeof STATUS_ICON];
              return (
                <div key={s.label}>
                  <div className="mb-1 flex items-center justify-between font-lp-body text-lp-body-sm">
                    <span className="flex items-center gap-1.5 font-medium text-lp-text-ink">
                      <span className={`h-1.5 w-1.5 rounded-full ${BAR_COLOR[s.tone]}`} />
                      {s.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-lp-mono text-lp-label-sm font-medium">{s.value} / 100</span>
                      <StatusIcon size={15} className={STATUS_COLOR[s.status]} />
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-lp-surface-subtle">
                    <div
                      className={`h-full rounded-full ${BAR_COLOR[s.tone]}`}
                      style={{ width: `${s.value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-auto flex items-center justify-between rounded border border-lp-border-hairline bg-lp-surface p-space-sm">
            <div>
              <span className="block font-lp-mono text-lp-label-sm uppercase text-lp-text-muted">
                Weekly Growth Velocity
              </span>
              <span className="font-lp-display text-lp-headline-sm font-medium text-lp-text-ink">
                +4.2% trajectory
              </span>
            </div>
            <svg width="128" height="32" viewBox="0 0 128 32" fill="none" className="text-lp-accent-indigo">
              <path
                d="M0 26 L24 22 L48 24 L72 16 L96 14 L128 4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path d="M0 26 L24 22 L48 24 L72 16 L96 14 L128 4 V32 H0 Z" fill="currentColor" fillOpacity="0.08" />
            </svg>
          </div>
        </div>

        {/* Col C: Next action + evidence */}
        <div className="flex flex-col justify-between gap-space-md lg:col-span-3">
          <div>
            <span className="font-lp-mono text-lp-label-md uppercase text-lp-text-muted">
              Recommended Next Action
            </span>
            <div className="mt-space-sm rounded-lg border border-lp-border-hairline bg-lp-surface p-space-md">
              <div className="flex items-center gap-1.5 font-lp-mono text-lp-label-sm font-semibold uppercase text-lp-accent-ochre">
                <Timer size={14} />
                Est. 42 mins remaining
              </div>
              <h3 className="mt-1 font-lp-display text-lp-headline-sm font-medium text-lp-text-ink">
                Retail Sales Outlier Audit
              </h3>
              <p className="mt-1 font-lp-body text-lp-body-sm text-lp-text-muted">
                Production SQL sandbox testing multi-store transaction anomalies with indexing
                benchmarks.
              </p>
              <button className="mt-3 w-full rounded bg-lp-text-ink py-2 font-lp-body text-lp-body-sm text-lp-surface-card transition-colors hover:bg-lp-inverse-surface">
                Launch Environment
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 rounded border border-lp-border-hairline bg-lp-surface-subtle p-space-md">
            <div className="flex items-center justify-between">
              <span className="font-lp-mono text-lp-label-sm uppercase text-lp-text-muted">
                Attested Evidence
              </span>
              <span className="rounded border border-lp-border-hairline bg-lp-surface px-1.5 py-0.5 font-lp-mono text-lp-label-sm text-lp-text-ink">
                12 / 12 PASS
              </span>
            </div>
            <div className="font-lp-mono text-lp-label-md font-semibold text-lp-text-ink">
              ROOT: SHA256:7f4c..9e10
            </div>
            <p className="font-lp-mono text-lp-label-sm leading-tight text-lp-text-muted">
              All submissions recorded with Git commit SHAs, mentor peer signoffs, and CPU
              profiling runs.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-space-sm border-t border-lp-border-hairline bg-lp-surface-subtle px-space-md py-3">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="font-lp-mono text-lp-label-sm font-semibold uppercase text-lp-text-muted">
            CONTINUOUS ENGINE:
          </span>
          {PIPELINE.map((p, i) => (
            <span key={p.step} className="flex items-center gap-2">
              <span
                className={`whitespace-nowrap rounded border border-lp-border-hairline bg-lp-surface-card px-2 py-0.5 font-lp-mono text-lp-label-sm ${
                  p.active
                    ? "font-medium text-lp-accent-ochre"
                    : p.indigo
                      ? "font-medium text-lp-accent-indigo"
                      : "text-lp-text-ink"
                }`}
              >
                {p.step}
              </span>
              {i < PIPELINE.length - 1 && <span className="text-lp-border-strong">→</span>}
            </span>
          ))}
        </div>
        <span className="font-lp-mono text-lp-label-sm italic text-lp-text-muted">
          Every technical keystroke becomes proof.
        </span>
      </div>
    </motion.div>
  );
}

export default function Hero() {
  return (
    <section className="lp-bg-grid relative w-full overflow-hidden bg-lp-surface px-margin-mobile pb-space-2xl pt-space-xl md:px-margin md:pt-space-2xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <div className="flex flex-col gap-space-lg md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-3xl flex-col gap-space-md">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex w-fit items-center gap-2 rounded border border-lp-border-hairline bg-lp-surface-card px-3 py-1"
            >
              <span className="lp-pulse h-2 w-2 animate-pulse rounded-full bg-lp-accent-ochre" />
              <span className="font-lp-mono text-lp-label-md uppercase tracking-widest text-lp-text-ink">
                AI Career Operating System
              </span>
              <span className="font-lp-mono text-lp-border-strong">|</span>
              <span className="font-lp-mono text-lp-label-sm text-lp-text-muted">v2.4 Kernel Active</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-lp-display text-lp-display-mobile leading-[1.08] tracking-tight text-lp-text-ink md:text-lp-display"
            >
              Your career needs
              <br className="hidden md:block" />
              more than a resume.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-2xl font-lp-body text-lp-body-lg text-lp-on-surface-variant"
            >
              Build skills. Practice on real challenges. Prove what you can do. Escape tutorial
              purgatory and build a technical career backed by immutable execution evidence.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col gap-space-xs md:items-end"
          >
            <div className="flex flex-wrap items-center gap-space-sm">
              <PrimaryButton href="/get-started">
                Get Started Free <ArrowRight size={16} />
              </PrimaryButton>
              <SecondaryButton href="#pipeline">
                <Terminal size={16} /> Inspect Proof Ledger
              </SecondaryButton>
            </div>
            <p className="flex items-center gap-1.5 font-lp-mono text-lp-label-sm text-lp-text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-lp-accent-indigo" />
              Free to start · Built for engineering cohorts · Cryptographic verification
            </p>
          </motion.div>
        </div>

        <WorkspaceCanvas />
      </div>
    </section>
  );
}
