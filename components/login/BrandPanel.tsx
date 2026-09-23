import Image from "next/image";
import { Cog, GraduationCap, Handshake, KeyRound, ListChecks, ShieldCheck, Zap, LucideIcon } from "lucide-react";

const JOURNEY: { label: string; icon: LucideIcon }[] = [
  { label: "Assess", icon: Zap },
  { label: "Learn", icon: GraduationCap },
  { label: "Practice", icon: Zap },
  { label: "Build", icon: Cog },
  { label: "Prove", icon: ListChecks },
  { label: "Get Hired", icon: Handshake },
];

const SIGNALS = [
  { label: "Encrypted channel", value: "TLS 1.3" },
  { label: "Identity verification", value: "Active" },
  { label: "MFA-ready architecture", value: "Enabled" },
];

export function BrandPanel() {
  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden bg-lp-surface px-10 py-16 lg:px-16 xl:px-20">
      <div className="lp-bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />

      <div className="relative">
        <a href="/" className="inline-flex items-center gap-2.5">
          <Image
            src="/logo-mark.jpg"
            alt="Capabilio AI"
            width={36}
            height={36}
            className="h-9 w-9 rounded object-cover"
            priority
          />
          <span className="font-lp-display text-lp-headline-sm font-semibold tracking-tight text-lp-text-ink">
            Capabilio <span className="text-lp-accent-ochre">AI</span>
          </span>
        </a>

        <h1 className="mt-10 font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink xl:text-lp-headline-lg">
          Build. Practice. Prove.
        </h1>
        <p className="mt-4 max-w-sm font-lp-body text-lp-body-lg text-lp-on-surface-variant">
          Your AI-powered career operating system.
        </p>
        <p className="mt-3 max-w-sm font-lp-body text-lp-body-sm leading-relaxed text-lp-text-muted">
          Learn the right skills, build real projects, prove your capability, and build a
          verified career profile.
        </p>

        <ol className="mt-12 flex flex-col" aria-label="The Capabilio journey">
          {JOURNEY.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === JOURNEY.length - 1;
            return (
              <li key={step.label} className="flex items-stretch gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-lp-border-hairline bg-lp-surface-card text-lp-accent-indigo">
                    <Icon size={16} />
                  </span>
                  {!isLast && <span className="my-1 w-px flex-1 bg-lp-border-hairline" />}
                </div>
                <span
                  className={`pb-8 pt-1.5 font-lp-mono text-lp-label-sm font-medium tracking-wide ${
                    isLast ? "text-lp-text-ink" : "text-lp-text-muted"
                  }`}
                >
                  {step.label.toUpperCase()}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="max-w-sm rounded-lg border border-lp-border-hairline bg-lp-surface-card p-space-md">
          <div className="flex items-center justify-between border-b border-lp-border-hairline pb-2">
            <span className="flex items-center gap-1.5 font-lp-mono text-lp-label-sm font-semibold uppercase tracking-wider text-lp-text-muted">
              <ShieldCheck size={13} className="text-lp-accent-indigo" />
              Auth Gateway
            </span>
            <span className="flex items-center gap-1.5 font-lp-mono text-lp-label-sm font-medium text-lp-accent-indigo">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lp-accent-indigo" />
              SECURE
            </span>
          </div>
          <div className="mt-2.5 flex flex-col gap-1.5 font-lp-mono text-lp-label-sm">
            {SIGNALS.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-lp-text-muted">
                <span className="flex items-center gap-1.5">
                  <KeyRound size={11} />
                  {s.label}
                </span>
                <span className="font-medium text-lp-text-ink">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
