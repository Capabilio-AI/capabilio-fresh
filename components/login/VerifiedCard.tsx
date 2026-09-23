import { CheckCircle2 } from "lucide-react";
import { CardChrome } from "./CardChrome";

export function VerifiedCard() {
  return (
    <CardChrome label="capabilio / verified">
      <div className="pt-1 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lp-surface-subtle text-lp-accent-indigo">
          <CheckCircle2 size={20} />
        </div>
        <h1 className="mt-4 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
          You&apos;re verified!
        </h1>
        <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-text-muted">
          Your account is ready. Sign in to start building your verified career profile.
        </p>
        <a
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded bg-lp-text-ink py-3 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface"
        >
          Go to login
        </a>
      </div>
    </CardChrome>
  );
}
