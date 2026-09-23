import { Reveal, SectionLabel } from "./ui";

const YEARS = [
  {
    year: "YEAR 01",
    title: "Discover & Baseline",
    body: "Explore foundational engineering paradigms, establish baseline coding diagnostic, and discover natural strengths through bite-sized Arena sandboxes.",
    milestone: "Milestone: First verified commit hash",
    tone: "text-lp-text-muted",
    emphasis: false,
  },
  {
    year: "YEAR 02",
    title: "Develop & Collaborate",
    body: "Complete personalized SkillStudio modules. Form first multidisciplinary teams to build cross-branch integrated software prototypes.",
    milestone: "Milestone: 1,100 ELO rating verified",
    tone: "text-lp-accent-ochre",
    emphasis: false,
  },
  {
    year: "YEAR 03",
    title: "Specialize & Harden",
    body: "Tackle high-concurrency production projects, contribute to real-world codebases, resolve live Arena outages, and receive industry mentor reviews.",
    milestone: "Milestone: 3 production project artifacts",
    tone: "text-lp-accent-indigo",
    emphasis: false,
  },
  {
    year: "YEAR 04",
    title: "Prove & Direct Place",
    body: "Deploy an immutable living portfolio. Bypass resume screenings through direct algorithmic matching with high-caliber technical recruiters.",
    milestone: "Milestone: Direct technical interview bypass",
    tone: "text-lp-text-ink",
    emphasis: true,
  },
];

export default function StudentJourney() {
  return (
    <section className="w-full bg-lp-surface px-margin-mobile py-space-2xl md:px-margin">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <Reveal className="flex max-w-3xl flex-col gap-space-xs">
          <SectionLabel tone="ochre">Institutional Progression</SectionLabel>
          <h2 className="font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink md:text-lp-headline-lg lg:text-lp-display">
            Start in first year. Graduate with proof.
          </h2>
          <p className="mt-1 font-lp-body text-lp-body-lg text-lp-text-muted">
            A four-year progressive scaffolding system that replaces cramming in semester 7 with
            compounding proof built from day one.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-4">
          {YEARS.map((y, i) => (
            <Reveal key={y.year} delay={i * 0.05}>
              <div
                className={`flex h-full flex-col justify-between rounded-lg border bg-lp-surface-card p-space-lg ${
                  y.emphasis ? "border-2 border-lp-text-ink shadow-sm" : "border-lp-border-hairline"
                }`}
              >
                <div>
                  <div className={`font-lp-mono text-lp-headline-md font-bold ${y.tone}`}>{y.year}</div>
                  <div className="mt-1 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                    {y.title}
                  </div>
                  <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-on-surface-variant">
                    {y.body}
                  </p>
                </div>
                <div
                  className={`mt-space-md border-t border-lp-border-hairline pt-2 font-lp-mono text-lp-label-sm ${
                    y.emphasis ? "font-semibold text-lp-accent-indigo" : "text-lp-text-muted"
                  }`}
                >
                  {y.milestone}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
