import { CheckCircle2 } from "lucide-react";
import { CardChrome } from "./CardChrome";
import { loginHref, type AuthPath } from "@/lib/onboarding/auth-path";

const COPY: Record<AuthPath, { title: string; body: string; cta: string }> = {
  student: {
    title: "You\u2019re verified!",
    body: "Your account is ready. Sign in to start building your verified career profile.",
    cta: "Go to login",
  },
  organisation: {
    title: "Email verified",
    body: "Thanks \u2014 your email is confirmed. Your organisation account now waits for manual approval; sign in at any time to see its status.",
    cta: "Go to organisation sign in",
  },
};

export function VerifiedCard({ path = "student" }: { path?: AuthPath }) {
  const copy = COPY[path];
  return (
    <CardChrome label={`capabilio / ${path === "student" ? "verified" : "organisation-verified"}`}>
      <div className="pt-1 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lp-surface-subtle text-lp-accent-indigo">
          <CheckCircle2 size={20} />
        </div>
        <h1 className="mt-4 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">{copy.title}</h1>
        <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-text-muted">{copy.body}</p>
        <a
          href={loginHref(path)}
          className="mt-6 inline-flex w-full items-center justify-center rounded bg-lp-text-ink py-3 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface"
        >
          {copy.cta}
        </a>
      </div>
    </CardChrome>
  );
}
