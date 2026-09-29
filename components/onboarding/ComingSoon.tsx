import { AuthLayout } from "@/components/login/AuthLayout";
import { Badge } from "@/components/ui";

// Static and input-free by design: no form, no storage, no backend.
export function ComingSoon({ title, tagline, subtext }: { title: string; tagline: string; subtext?: string }) {
  return (
    <AuthLayout>
      <div className="w-full max-w-md rounded-xl border border-lp-border-hairline bg-lp-surface-card p-8 shadow-sm">
        <Badge tone="ochre">COMING SOON</Badge>
        <h1 className="mt-4 font-lp-display text-lp-headline-md font-semibold tracking-tight text-lp-text-ink">{title}</h1>
        <p className="mt-2 font-lp-body text-lp-body-sm text-lp-text-ink">{tagline}</p>
        {subtext && <p className="mt-1 font-lp-body text-lp-body-sm text-lp-text-muted">{subtext}</p>}
        <p className="mt-5 font-lp-body text-lp-body-sm text-lp-text-muted">
          This path isn&apos;t open yet. We&apos;re not collecting sign-ups for it, so there&apos;s nothing to fill in.
        </p>
        <a href="/get-started" className="mt-6 inline-block font-lp-body text-lp-body-sm font-medium text-lp-accent-indigo hover:underline">
          ← Choose a different path
        </a>
      </div>
    </AuthLayout>
  );
}
