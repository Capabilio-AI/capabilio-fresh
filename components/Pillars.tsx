import { Reveal, SectionLabel } from "./ui";

const PILLARS = [
  {
    n: "PILLAR 01",
    tone: "text-lp-accent-indigo",
    title: "Career Intelligence Core",
    body: "Continuously ingests thousands of market job descriptions, extracting active requirements and mapping them directly into student capability vectors.",
  },
  {
    n: "PILLAR 02",
    tone: "text-lp-accent-ochre",
    title: "Targeted SkillStudio",
    body: "Eliminates linear courses. Delivers only the precise theoretical modules needed to pass the upcoming project task or Arena incident.",
  },
  {
    n: "PILLAR 03",
    tone: "text-lp-text-ink",
    title: "Production Sandboxes",
    body: "Ephemeral containerized environments with realistic DB loads, test harnesses, and compiler outputs inside the browser.",
  },
  {
    n: "PILLAR 04",
    tone: "text-lp-accent-indigo",
    title: "Immutable Proof Ledger",
    body: "Every commit, PR merge, test assertion, and runtime speed benchmark is cryptographically verified to guarantee authenticity.",
  },
];

export default function Pillars() {
  return (
    <section className="w-full bg-lp-surface px-margin-mobile py-space-2xl md:px-margin">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <Reveal className="flex flex-col gap-space-md md:flex-row md:items-end md:justify-between">
          <div>
            <SectionLabel tone="ochre">Architectural Foundation</SectionLabel>
            <h2 className="mt-1 font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink md:text-lp-headline-lg lg:text-lp-display">
              Why Capabilio?
            </h2>
          </div>
          <p className="max-w-md font-lp-body text-lp-body-sm text-lp-text-muted">
            Built from the ground up as an engineering operating system, not a content library.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.n} delay={i * 0.05}>
              <div className="h-full rounded-lg border border-lp-border-hairline bg-lp-surface-card p-space-lg">
                <span className={`mb-1 block font-lp-mono text-lp-label-sm font-bold ${p.tone}`}>{p.n}</span>
                <h3 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                  {p.title}
                </h3>
                <p className="mt-2 font-lp-body text-lp-body-sm text-lp-on-surface-variant">{p.body}</p>
              </div>
            </Reveal>
          ))}

          <Reveal delay={0.25} className="flex flex-col justify-between rounded-lg border border-lp-border-hairline bg-lp-surface-card p-space-lg lg:col-span-2">
            <div>
              <span className="mb-1 block font-lp-mono text-lp-label-sm font-bold text-lp-accent-ochre">
                PILLAR 05
              </span>
              <h3 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                Living Proof Profiles
              </h3>
              <p className="mt-2 font-lp-body text-lp-body-sm text-lp-on-surface-variant">
                A public, verifiable profile that replaces both the paper resume and static
                GitHub repositories with deep, inspectable engineering metrics.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-lp-border-hairline pt-3 font-lp-mono text-lp-label-sm text-lp-text-muted">
              <span>Proof of work over proof of presence.</span>
              <span className="font-semibold text-lp-text-ink">capabilio.id/username</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
