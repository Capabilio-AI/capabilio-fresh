import Image from "next/image";
import { BarChart3, ClipboardCheck, Cog, GraduationCap, Handshake, KeyRound, ListChecks, Network, ShieldCheck, UserCheck, Users, Zap, LucideIcon } from "lucide-react";
import type { AuthPath } from "@/lib/onboarding/auth-path";

const STUDENT_JOURNEY: { label: string; icon: LucideIcon }[] = [
  { label: "Assess", icon: Zap },
  { label: "Learn", icon: GraduationCap },
  { label: "Practice", icon: Zap },
  { label: "Build", icon: Cog },
  { label: "Prove", icon: ListChecks },
  { label: "Get Hired", icon: Handshake },
];

const ORG_JOURNEY: { label: string; icon: LucideIcon }[] = [
  { label: "Register", icon: ClipboardCheck },
  { label: "Verify", icon: UserCheck },
  { label: "Approval", icon: ShieldCheck },
  { label: "Connect", icon: Network },
  { label: "Assess", icon: Users },
  { label: "Understand", icon: BarChart3 },
];

const COPY: Record<AuthPath, { title: string; lead: string; body: string; journey: typeof STUDENT_JOURNEY; journeyLabel: string }> = {
  student: {
    title: "Build. Practice. Prove.",
    lead: "Your AI-powered career operating system.",
    body: "Learn the right skills, build real projects, prove your capability, and build a verified career profile.",
    journey: STUDENT_JOURNEY,
    journeyLabel: "The Capabilio journey",
  },
  organisation: {
    title: "Understand your people.",
    lead: "Connect, assess, and develop — with evidence, not claims.",
    body: "For colleges, universities and companies. Organisation accounts are reviewed manually before they are activated.",
    journey: ORG_JOURNEY,
    journeyLabel: "Organisation onboarding",
  },
};

const SIGNALS = [
  { label: "Encrypted channel", value: "TLS 1.3" },
  { label: "Identity verification", value: "Active" },
  { label: "MFA-ready architecture", value: "Enabled" },
];

export function BrandPanel({ path = "student" }: { path?: AuthPath }) {
  const copy = COPY[path];
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
          {copy.title}
        </h1>
        <p className="mt-4 max-w-sm font-lp-body text-lp-body-lg text-lp-on-surface-variant">
          {copy.lead}
        </p>
        <p className="mt-3 max-w-sm font-lp-body text-lp-body-sm leading-relaxed text-lp-text-muted">
          {copy.body}
        </p>

        <ol className="mt-12 flex flex-col" aria-label={copy.journeyLabel}>
          {copy.journey.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === copy.journey.length - 1;
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

        {path === "organisation" ? (
          <div className="max-w-sm rounded-lg border border-lp-border-hairline bg-lp-surface-card p-space-md font-lp-body text-lp-body-sm text-lp-text-muted">
            <span className="flex items-center gap-1.5 font-lp-mono text-lp-label-sm font-semibold uppercase tracking-wider">
              <ShieldCheck size={13} className="text-lp-accent-indigo" />
              Manual approval
            </span>
            <p className="mt-2">Every new organisation is checked by our team. You can sign in at any time to see where your application stands.</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
