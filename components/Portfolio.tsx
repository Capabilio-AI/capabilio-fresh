import { BadgeCheck, GitCommit } from "lucide-react";
import { Reveal, SectionLabel } from "./ui";

const CONTRIBUTIONS = [
  { name: "Ananya", detail: "DB & APIs (35%)", width: 35, tone: "bg-lp-accent-indigo" },
  { name: "Rahul: Front-end (25%)", detail: "", width: 25, tone: "bg-lp-accent-ochre" },
  { name: "Priya: ML Models (22%)", detail: "", width: 22, tone: "bg-lp-text-ink" },
  { name: "Dev: Docker & CI (18%)", detail: "", width: 18, tone: "bg-lp-border-strong" },
];

export default function Portfolio() {
  return (
    <section className="w-full border-y border-lp-border-hairline bg-lp-surface-subtle px-margin-mobile py-space-2xl md:px-margin">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <Reveal className="flex max-w-3xl flex-col gap-space-xs">
          <SectionLabel tone="indigo">Attribution Truth</SectionLabel>
          <h2 className="font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink md:text-lp-headline-lg lg:text-lp-display">
            Team projects. Individual proof.
          </h2>
          <p className="mt-1 font-lp-body text-lp-body-lg text-lp-text-muted">
            The whole team builds together, but your individual capability remains distinctly
            yours. Capabilio isolates your specific commits, pull requests, and architecture
            choices.
          </p>
        </Reveal>

        <Reveal className="flex flex-col gap-space-lg rounded-xl border border-lp-border-hairline bg-lp-surface-card p-space-lg shadow-sm">
          <div className="flex flex-col items-start justify-between gap-space-md border-b border-lp-border-hairline pb-space-md md:flex-row md:items-center">
            <div className="flex items-center gap-space-md">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-lp-text-ink font-lp-display text-lp-headline-sm font-semibold text-lp-surface-card">
                AR
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-lp-display text-lp-headline-md font-semibold text-lp-text-ink">
                    Ananya Rao
                  </span>
                  <BadgeCheck size={18} className="text-lp-accent-indigo" />
                </div>
                <p className="font-lp-body text-lp-body-sm text-lp-text-muted">
                  B.Tech Computer Science (3rd Year) • Track: Data Analytics &amp; Systems
                </p>
              </div>
            </div>
            <div className="flex items-center gap-space-lg">
              <div>
                <span className="block font-lp-mono text-lp-label-sm uppercase text-lp-text-muted">
                  Verified ELO
                </span>
                <span className="font-lp-mono text-lp-headline-md font-bold text-lp-text-ink">1,300</span>
              </div>
              <div>
                <span className="block font-lp-mono text-lp-label-sm uppercase text-lp-text-muted">
                  Code Commits
                </span>
                <span className="font-lp-mono text-lp-headline-md font-bold text-lp-accent-indigo">34</span>
              </div>
              <div>
                <span className="block font-lp-mono text-lp-label-sm uppercase text-lp-text-muted">
                  Mentor Reviews
                </span>
                <span className="font-lp-mono text-lp-headline-md font-bold text-lp-accent-ochre">
                  6 Sign-offs
                </span>
              </div>
            </div>
          </div>

          <div>
            <span className="font-lp-mono text-lp-label-md uppercase tracking-wider text-lp-text-muted">
              Featured Capstone Project
            </span>
            <div className="mt-2 flex flex-col gap-space-md rounded-lg border border-lp-border-hairline bg-lp-surface p-space-md">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                    Smart Healthcare Monitoring Platform
                  </h3>
                  <p className="font-lp-body text-lp-body-sm text-lp-text-muted">
                    Microservice architecture processing real-time telemetry from 500 bed
                    sensors.
                  </p>
                </div>
                <span className="rounded border border-lp-border-hairline bg-lp-surface-card px-2.5 py-1 font-lp-mono text-lp-label-sm font-medium text-lp-text-ink">
                  Team Size: 4 Members
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-lp-mono text-lp-label-sm font-semibold uppercase text-lp-text-muted">
                  Verified Contribution Split:
                </span>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-lp-surface-subtle">
                  {CONTRIBUTIONS.map((c) => (
                    <div
                      key={c.name}
                      className={`h-full ${c.tone}`}
                      style={{ width: `${c.width}%` }}
                      title={c.name}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-space-sm pt-2 font-lp-mono text-lp-label-sm md:grid-cols-4">
                  {CONTRIBUTIONS.map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center gap-2 rounded border border-lp-border-hairline bg-lp-surface-card p-1.5"
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${c.tone}`} />
                      <span className="truncate">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded border border-lp-border-hairline bg-lp-surface-card p-space-sm font-lp-mono text-lp-label-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <GitCommit size={18} className="text-lp-accent-indigo" />
                  <span className="font-medium text-lp-text-ink">
                    PR #42: Add Redis Pub/Sub backpressure buffer
                  </span>
                </div>
                <div className="flex items-center gap-space-md text-lp-text-muted">
                  <span>+840 / -112 lines</span>
                  <span>Mentor: Verified by @alex_arch</span>
                  <a href="#" className="font-semibold text-lp-text-ink underline underline-offset-4">
                    Inspect Diff →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
