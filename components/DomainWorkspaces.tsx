import { Brain, CodeXml, Database, ShieldAlert } from "lucide-react";
import { Reveal, SectionLabel } from "./ui";

const TRACKS = [
  {
    icon: CodeXml,
    title: "Software Engineering",
    body: "Full-stack TypeScript, Go, or Python. Live Postgres instances, Jest test runners, Docker configs, and automated PR diff analyzers.",
    footer: "Includes: Git workflow & API mocks",
  },
  {
    icon: Database,
    title: "Data Analytics",
    body: "Pre-cleaned million-row datasets, high-throughput SQL sandboxes, hosted Jupyter kernels, and Apache Superset visual report generators.",
    footer: "Includes: DuckDB & Parquet pipelines",
  },
  {
    icon: Brain,
    title: "AI / ML Systems",
    body: "PyTorch training loops, Hugging Face integrations, Weights & Biases telemetry logging, and model latency evaluation frameworks.",
    footer: "Includes: Eval suites & Quantization",
  },
  {
    icon: ShieldAlert,
    title: "Cybersecurity",
    body: "Isolated Linux penetration sandboxes, packet capture analyzers, vulnerability scanner logs, and verified security audit reports.",
    footer: "Includes: Root exploit verification",
  },
];

export default function DomainWorkspaces() {
  return (
    <section className="w-full bg-lp-surface-subtle px-margin-mobile py-space-2xl md:px-margin">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <Reveal className="flex flex-col gap-space-md md:flex-row md:items-end md:justify-between">
          <div>
            <SectionLabel tone="indigo">Specialized Sandboxes</SectionLabel>
            <h2 className="mt-1 font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink md:text-lp-headline-lg lg:text-lp-display">
              Build where the work happens.
            </h2>
          </div>
          <p className="max-w-md font-lp-body text-lp-body-sm text-lp-text-muted">
            Zero local configuration friction. Browser-based, bare-metal containerized
            environments built specifically for every branch of engineering.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-4">
          {TRACKS.map((t, i) => {
            const Icon = t.icon;
            return (
              <Reveal key={t.title} delay={i * 0.05}>
                <div className="flex h-full flex-col justify-between rounded-lg border border-lp-border-hairline bg-lp-surface-card p-space-lg transition-colors hover:border-lp-text-ink">
                  <div>
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-lp-border-hairline bg-lp-surface-subtle text-lp-text-ink">
                      <Icon size={22} />
                    </div>
                    <h3 className="mt-2 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                      {t.title}
                    </h3>
                    <p className="mt-2 font-lp-body text-lp-body-sm text-lp-on-surface-variant">{t.body}</p>
                  </div>
                  <div className="mt-space-md border-t border-lp-border-hairline pt-space-sm font-lp-mono text-lp-label-sm text-lp-text-muted">
                    {t.footer}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="flex flex-col items-center justify-between gap-space-sm rounded border border-lp-border-hairline bg-lp-surface p-space-md sm:flex-row">
          <span className="font-lp-body text-lp-body-sm font-medium text-lp-text-ink">
            Extended Engineering Modules: Embedded Systems (ECE), CAD/Simulations (Mechanical),
            Structural Analysis (Civil), and Enterprise SAP ABAP.
          </span>
          <span className="font-lp-mono text-lp-label-sm uppercase text-lp-text-muted">
            Full Branch Parity
          </span>
        </Reveal>
      </div>
    </section>
  );
}
