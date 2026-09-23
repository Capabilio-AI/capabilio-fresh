import { AlertCircle, GitCommit, ShieldCheck } from "lucide-react";
import { Badge, Reveal, SectionLabel } from "./ui";

export default function ProblemSection() {
  return (
    <section className="w-full border-y border-lp-border-hairline bg-lp-surface-subtle px-margin-mobile py-space-2xl md:px-margin">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <Reveal className="flex max-w-3xl flex-col gap-space-sm">
          <SectionLabel tone="ochre">The Credibility Void</SectionLabel>
          <h2 className="font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink md:text-lp-headline-lg lg:text-lp-display">
            A resume tells people what you claim.
            <br />
            Capabilio proves what you&apos;ve actually executed.
          </h2>
          <p className="font-lp-body text-lp-body-lg text-lp-text-muted">
            Generic certifications and self-styled bullet points have broken the hiring signal.
            Recruiters spend billions filtering claims because credentials no longer measure
            capability.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 items-stretch gap-space-lg lg:grid-cols-2">
          <Reveal className="flex flex-col justify-between rounded-lg border border-lp-border-hairline bg-lp-surface p-space-lg">
            <div>
              <div className="flex items-center justify-between border-b border-lp-border-hairline pb-space-sm">
                <span className="font-lp-mono text-lp-label-md uppercase text-lp-text-muted">
                  Traditional Paper Resume (PDF)
                </span>
                <Badge tone="error">UNVERIFIED CLAIMS</Badge>
              </div>
              <div className="mt-space-md flex flex-col gap-space-md opacity-85">
                <div className="rounded border border-dashed border-lp-border-strong bg-lp-surface-card p-space-sm">
                  <div className="font-lp-display text-lp-headline-sm font-medium text-lp-text-muted line-through">
                    Technical Skills
                  </div>
                  <p className="mt-1 font-lp-body text-lp-body-sm text-lp-text-muted">
                    • Python — Advanced (Scikit-Learn, TensorFlow, Django)
                    <br />
                    • SQL — Database optimization, BigQuery, complex warehousing
                    <br />
                    • Machine Learning — Deep understanding of production LLMs
                  </p>
                </div>
                <div className="rounded border border-dashed border-lp-border-strong bg-lp-surface-card p-space-sm">
                  <div className="font-lp-display text-lp-headline-sm font-medium text-lp-text-muted line-through">
                    Projects &amp; Experience
                  </div>
                  <p className="mt-1 font-lp-body text-lp-body-sm text-lp-text-muted">
                    • <em>&quot;Built an end-to-end sentiment engine with 99% accuracy&quot;</em>
                    <br />
                    • <em>&quot;Engineered real-time database schema for college portal&quot;</em>
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-space-lg flex items-start gap-3 rounded border border-lp-border-hairline bg-lp-surface-card p-space-md">
              <AlertCircle size={20} className="mt-0.5 shrink-0 text-lp-error" />
              <div>
                <div className="font-lp-body text-lp-body-sm font-semibold text-lp-text-ink">
                  Zero Operational Artifacts
                </div>
                <p className="font-lp-mono text-lp-label-sm text-lp-text-muted">
                  No commit hashes, no live code telemetry, no peer review logs, no sandbox
                  validation. Easily copied from tutorials or fabricated with prompts.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal
            delay={0.1}
            className="flex flex-col justify-between rounded-lg border-2 border-lp-text-ink bg-lp-surface-card p-space-lg shadow-md"
          >
            <div>
              <div className="flex items-center justify-between border-b border-lp-border-hairline pb-space-sm">
                <span className="font-lp-mono text-lp-label-md font-bold uppercase tracking-wider text-lp-accent-indigo">
                  Capabilio Execution Ledger
                </span>
                <Badge tone="indigo">IMMUTABLE TELEMETRY</Badge>
              </div>
              <div className="mt-space-md flex flex-col gap-space-sm">
                <div className="rounded border border-lp-border-hairline bg-lp-surface p-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-lp-body text-lp-body-sm font-semibold text-lp-text-ink">
                      Python Production Benchmark: 78 ELO
                    </span>
                    <span className="font-lp-mono text-lp-label-sm text-lp-accent-indigo">
                      14 Code Commits
                    </span>
                  </div>
                  <p className="mt-1 font-lp-mono text-lp-label-sm text-lp-text-muted">
                    14 passing test assertions, memory profiling verified below 42MB, 0 runtime
                    exceptions across stress tests.
                  </p>
                  <div className="mt-2 flex items-center gap-2 font-lp-mono text-[10px] text-lp-text-muted">
                    <span>SHA: 9df1..43a</span>
                    <span>•</span>
                    <span>PyTest: 100% Pass</span>
                    <span>•</span>
                    <span>Cyclomatic Complexity: 3.2</span>
                  </div>
                </div>
                <div className="rounded border border-lp-border-hairline bg-lp-surface p-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-lp-body text-lp-body-sm font-semibold text-lp-text-ink">
                      Project: Retail Sales Intelligence Engine
                    </span>
                    <span className="font-lp-mono text-lp-label-sm font-bold text-lp-text-ink">
                      4-Person Team
                    </span>
                  </div>
                  <p className="mt-1 font-lp-mono text-lp-label-sm text-lp-text-muted">
                    Authored PostgreSQL schema migrations, indexed 4 Foreign Keys reducing query
                    time by 78%, and created live Superset visualizations.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded border border-lp-border-hairline bg-lp-surface-card px-1.5 py-0.5 font-lp-mono text-[10px] text-lp-text-ink">
                      Individual Contribution: 38%
                    </span>
                    <span className="flex items-center gap-1 rounded border border-lp-border-hairline bg-lp-surface-card px-1.5 py-0.5 font-lp-mono text-[10px] font-medium text-lp-accent-indigo">
                      <GitCommit size={11} /> Peer Validated
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-space-lg flex items-start gap-3 rounded border border-lp-border-hairline bg-lp-surface-subtle p-space-md">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-lp-accent-indigo" />
              <div>
                <div className="font-lp-body text-lp-body-sm font-semibold text-lp-text-ink">
                  Verifiable Ground Truth
                </div>
                <p className="font-lp-mono text-lp-label-sm text-lp-text-muted">
                  Every line of code, benchmark runtime, and mentor code review is
                  cryptographically linked to the student&apos;s permanent profile.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
