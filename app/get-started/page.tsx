import type { Metadata } from "next";
import { Badge } from "@/components/ui";
import { ONBOARDING_PATHS } from "@/lib/onboarding/paths";

export const metadata: Metadata = {
  title: "Get started — Capabilio AI",
  description: "Choose how you'll use Capabilio AI.",
};

export default function GetStartedPage() {
  return (
    <main className="lp-bg-grid min-h-screen bg-lp-surface-subtle px-margin-mobile py-space-2xl md:px-margin">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-lp-display text-lp-headline-lg font-semibold tracking-tight text-lp-text-ink">
          How will you use Capabilio?
        </h1>
        <p className="mt-2 font-lp-body text-lp-body-sm text-lp-text-muted">
          Choose your path. Already have an account?{" "}
          <a href="/login" className="font-medium text-lp-accent-indigo hover:underline">Sign in</a>
        </p>
        <div className="mt-space-xl grid grid-cols-1 gap-space-lg sm:grid-cols-2">
          {ONBOARDING_PATHS.map((p) => (
            <a
              key={p.id}
              href={p.href}
              data-path={p.id}
              className="flex h-full flex-col rounded-xl border border-lp-border-hairline bg-lp-surface-card p-space-lg transition-colors hover:border-lp-accent-indigo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-accent-indigo/25"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-lp-display text-lp-headline-md font-semibold text-lp-text-ink">{p.title}</h2>
                {p.comingSoon && <Badge tone="ochre">COMING SOON</Badge>}
              </div>
              <p className="mt-2 font-lp-body text-lp-body-sm text-lp-on-surface-variant">{p.tagline}</p>
              {p.subtext && <p className="mt-1 font-lp-body text-lp-body-sm text-lp-text-muted">{p.subtext}</p>}
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
