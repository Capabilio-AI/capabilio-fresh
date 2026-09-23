import { Reveal, SectionLabel } from "./ui";

const STAKEHOLDERS = [
  {
    n: "01",
    tone: "text-lp-text-ink",
    title: "For Students",
    body: "Know exactly where you stand against global market requirements. Stop memorizing quiz answers and build high-signal proof that commands attention.",
    points: [
      "Real-time skill vector diagnostics",
      "Zero tutorial rabbit holes",
      "Individual contribution attribution",
    ],
    cta: "Explore student features →",
  },
  {
    n: "02",
    tone: "text-lp-accent-ochre",
    title: "For Colleges",
    body: "Empower placement cells with programmatic cohort tracking. Identify curriculum gaps before final year and verify institutional student readiness with hard data.",
    points: [
      "Cohort ELO distribution metrics",
      "Real-time curriculum delta alerts",
      "Automated accreditation documentation",
    ],
    cta: "Explore college platform →",
  },
  {
    n: "03",
    tone: "text-lp-accent-indigo",
    title: "For Recruiters",
    body: "Skip generic PDF resumes and 45-minute screening calls. Query candidates by demonstrated ELO, PR depth, test coverage, and sandbox performance.",
    points: [
      "Filter by verified code assertions",
      "Direct review of git diff histories",
      "80% reduction in first-round drop-off",
    ],
    cta: "Explore recruiter pipeline →",
  },
];

export default function Stakeholders() {
  return (
    <section className="w-full border-y border-lp-border-hairline bg-lp-surface-subtle px-margin-mobile py-space-2xl md:px-margin" id="ecosystem">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <Reveal className="flex max-w-3xl flex-col gap-space-xs">
          <SectionLabel tone="indigo">The Entire Ecosystem</SectionLabel>
          <h2 className="font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink md:text-lp-headline-lg lg:text-lp-display">
            Engineered for every participant in the talent loop.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-3">
          {STAKEHOLDERS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.06}>
              <div className="flex h-full flex-col justify-between rounded-xl border border-lp-border-hairline bg-lp-surface-card p-space-lg">
                <div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded bg-lp-surface-subtle font-lp-mono font-bold ${s.tone}`}>
                    {s.n}
                  </div>
                  <h3 className="mt-space-md font-lp-display text-lp-headline-md font-semibold text-lp-text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-2 font-lp-body text-lp-body-sm text-lp-on-surface-variant">{s.body}</p>
                  <ul className="mt-space-md flex flex-col gap-2 font-lp-body text-lp-body-sm text-lp-text-muted">
                    {s.points.map((p) => (
                      <li key={p} className="flex items-center gap-2">
                        • {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <a
                  href="#"
                  className="mt-space-lg flex items-center gap-1 font-lp-body text-lp-body-sm font-semibold text-lp-text-ink hover:underline"
                >
                  {s.cta}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
