const COLUMNS = [
  {
    title: "Product",
    links: ["Platform Overview", "Capability Engine", "Technical Arena", "Benchmarks & Models"],
  },
  {
    title: "For Students",
    links: ["Skill Graph", "Guided Projects", "Portfolio Proof", "Student Grants"],
  },
  {
    title: "For Colleges",
    links: ["Curriculum Sync", "Institutional Cohorts", "Skill Verification", "Accreditation Data"],
  },
  {
    title: "For Recruiters",
    links: ["Direct Sourcing", "Verified Competencies", "Arena Challenges", "Enterprise API"],
  },
  {
    title: "Company",
    links: ["Research Philosophy", "Publications", "Careers", "Press & Media"],
  },
  {
    title: "Legal & Security",
    links: ["Privacy Charter", "Terms of Intelligence", "Model Governance", "Security Protocol"],
  },
];

export default function Footer() {
  return (
    <footer className="w-full bg-lp-surface-container-low">
      <div className="mx-auto max-w-7xl px-margin-mobile pb-space-xl pt-space-2xl md:px-margin">
        <div className="grid grid-cols-2 gap-space-lg pb-space-xl md:grid-cols-4 lg:grid-cols-6">
          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-space-sm">
              <div className="font-lp-mono text-lp-label-md uppercase tracking-wider text-lp-text-muted">
                {col.title}
              </div>
              <ul className="flex flex-col gap-space-xs">
                {col.links.map((link) => (
                  <li
                    key={link}
                    className="cursor-pointer font-lp-body text-lp-body-sm text-lp-on-surface-variant hover:text-lp-text-ink"
                  >
                    {link}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-space-md border-t border-lp-border-hairline pt-space-lg md:flex-row">
          <div className="flex items-center gap-space-md">
            <span className="font-lp-display text-lp-headline-sm font-semibold tracking-tight text-lp-text-ink">
              Capabilio <span className="text-lp-accent-ochre">AI</span>
            </span>
            <span className="font-lp-body text-lp-body-sm text-lp-text-muted">
              © 2025 Capabilio AI Intelligence Inc. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-space-sm rounded-full bg-lp-surface-card px-space-sm py-1">
            <span className="h-2 w-2 rounded-full bg-lp-accent-indigo" />
            <span className="font-lp-mono text-lp-label-sm text-lp-text-ink">
              SYSTEMS OPERATIONAL • LATENCY 24MS
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
