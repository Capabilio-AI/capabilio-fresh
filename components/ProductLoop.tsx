import {
  Activity,
  Compass,
  Cog,
  GraduationCap,
  Handshake,
  IdCard,
  ListChecks,
  Zap,
  LucideIcon,
} from "lucide-react";
import { Reveal, SectionLabel } from "./ui";

const STEPS: { n: string; title: string; body: string; output: string; icon: LucideIcon; accent?: "ochre" | "indigo" }[] = [
  {
    n: "01",
    title: "Assess",
    body: "Baseline capability scan via code challenges, logic profiling, and systems telemetry.",
    output: "Empirical baseline",
    icon: Activity,
  },
  {
    n: "02",
    title: "Discover",
    body: "Match cognitive strengths and code styles to high-demand industry archetypes.",
    output: "Career vector",
    icon: Compass,
  },
  {
    n: "03",
    title: "Learn",
    body: "Targeted delta curriculum. Learn only the precise concepts required to bridge your current gap.",
    output: "Concept acquisition",
    icon: GraduationCap,
    accent: "ochre",
  },
  {
    n: "04",
    title: "Practice",
    body: "Solve real-world incident simulations and timed architecture challenges in the Arena.",
    output: "ELO calibration",
    icon: Zap,
  },
  {
    n: "05",
    title: "Build",
    body: "Collaborative project sandboxes with branch merges, test suites, and peer review.",
    output: "Production software",
    icon: Cog,
  },
  {
    n: "06",
    title: "Prove",
    body: "Automatic assertion passes, commit diffs, and mentor code reviews seal your execution.",
    output: "Verified artifacts",
    icon: ListChecks,
    accent: "indigo",
  },
  {
    n: "07",
    title: "Showcase",
    body: "Interactive public portfolio linking directly to code commits, architecture, and metrics.",
    output: "Living portfolio",
    icon: IdCard,
  },
  {
    n: "08",
    title: "Get Hired",
    body: "Recruiters query by demonstrated capability and PR depth, bypassing initial filters.",
    output: "Verified placement",
    icon: Handshake,
  },
];

export default function ProductLoop() {
  return (
    <section className="w-full bg-lp-surface px-margin-mobile py-space-2xl md:px-margin" id="pipeline">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <Reveal className="flex flex-col gap-space-md md:flex-row md:items-end md:justify-between">
          <div>
            <SectionLabel tone="indigo">The Closed-Loop Engine</SectionLabel>
            <h2 className="mt-1 font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink md:text-lp-headline-lg lg:text-lp-display">
              One career system. From potential to proof.
            </h2>
          </div>
          <p className="max-w-md font-lp-body text-lp-body-sm text-lp-text-muted">
            Not disparate apps, courses, and job boards. An interconnected loop where your
            practice directly feeds your verified portfolio.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const accentText =
              s.accent === "ochre"
                ? "text-lp-accent-ochre"
                : s.accent === "indigo"
                  ? "text-lp-accent-indigo"
                  : "text-lp-text-muted";
            return (
              <Reveal key={s.n} delay={i * 0.04}>
                <div className="group flex h-full flex-col justify-between rounded border border-lp-border-hairline bg-lp-surface-card p-space-md transition-colors hover:border-lp-text-ink">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className={`font-lp-mono text-lp-headline-sm font-semibold ${accentText} group-hover:text-lp-text-ink`}>
                        {s.n}
                      </span>
                      <Icon size={18} className={accentText} />
                    </div>
                    <div className="font-lp-display text-lp-headline-sm font-medium text-lp-text-ink">
                      {s.title}
                    </div>
                    <p className="font-lp-body text-lp-body-sm text-lp-on-surface-variant">{s.body}</p>
                  </div>
                  <div className="mt-4 border-t border-lp-border-hairline pt-2 font-lp-mono text-lp-label-sm text-lp-text-muted">
                    Output: {s.output}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
