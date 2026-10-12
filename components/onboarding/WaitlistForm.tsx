"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { CardChrome } from "@/components/login/CardChrome";

type WaitlistPath = "professional" | "executive";

const FIELD_LABEL = "mb-2 block text-sm font-medium text-cap-ink/80";
const FIELD_INPUT = "w-full px-4 py-3 text-sm text-cap-ink placeholder:text-cap-muted";

const COPY: Record<WaitlistPath, { roleLabel: string; rolePlaceholder: string; companyLabel: string; companyPlaceholder: string }> = {
  professional: { roleLabel: "Your role", rolePlaceholder: "e.g. Software engineer", companyLabel: "Company (optional)", companyPlaceholder: "Where you work" },
  executive: { roleLabel: "Your role", rolePlaceholder: "e.g. Founder, CEO, Director", companyLabel: "Company", companyPlaceholder: "Your company or startup" },
};

export function WaitlistForm({ path, title, tagline, subtext }: { path: WaitlistPath; title: string; tagline: string; subtext?: string }) {
  const copy = COPY[path];
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, fullName, email, roleTitle: roleTitle || undefined, company: company || undefined }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) return setError(body?.error ?? "Something went wrong. Please try again.");
      setDone(true);
    } catch {
      setError("Connection problem. Please check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <CardChrome label={`${title} early access`}>
        <div className="py-4 text-center" data-testid="waitlist-confirmation">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cap-indigo-soft text-cap-indigo">
            <CheckCircle2 size={26} />
          </div>
          <h1 className="mt-5 font-cap-display text-3xl font-semibold tracking-tight">You are on the list</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-cap-muted">
            We will email <strong className="text-cap-ink">{email}</strong> when the {title} path opens. No account was created.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link href="/get-started" className="rounded-full bg-cap-ink px-5 py-3 text-sm font-semibold text-cap-paper">Choose another path</Link>
            <Link href="/" className="rounded-full border border-cap-ink/25! px-5 py-3 text-sm font-semibold">Back to the home page</Link>
          </div>
        </div>
      </CardChrome>
    );
  }

  return (
    <CardChrome label={`${title} early access`}>
      <span className="inline-flex items-center gap-2 rounded-full bg-cap-peach px-3 py-1 text-xs font-semibold text-cap-ink">
        <span className="cap-pulse h-1.5 w-1.5 rounded-full bg-cap-orange" />
        Coming soon · early access
      </span>
      <h1 className="mt-4 font-cap-display text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-[15px] font-medium leading-snug">{tagline}</p>
      {subtext && <p className="mt-1 text-sm text-cap-muted">{subtext}</p>}

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="wl-name" className={FIELD_LABEL}>Full name</label>
          <input id="wl-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" className={FIELD_INPUT} />
        </div>
        <div>
          <label htmlFor="wl-email" className={FIELD_LABEL}>Email</label>
          <input id="wl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com" className={FIELD_INPUT} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="wl-role" className={FIELD_LABEL}>{copy.roleLabel}</label>
            <input id="wl-role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder={copy.rolePlaceholder} autoComplete="organization-title" className={FIELD_INPUT} />
          </div>
          <div>
            <label htmlFor="wl-company" className={FIELD_LABEL}>{copy.companyLabel}</label>
            <input id="wl-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={copy.companyPlaceholder} autoComplete="organization" className={FIELD_INPUT} />
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl bg-[#fdf0e0] px-4 py-3 text-sm text-cap-warn">{error}</p>}

        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-70">
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Joining…
            </>
          ) : (
            <>
              Join the early-access list <ArrowRight size={16} />
            </>
          )}
        </button>
        <p className="text-center text-xs leading-relaxed text-cap-muted">We will only use your email to tell you when this path opens. No account is created yet.</p>
      </form>
      <p className="mt-5 text-center text-sm text-cap-muted">
        <Link href="/get-started" className="font-medium text-cap-indigo underline">Choose a different path</Link>
      </p>
    </CardChrome>
  );
}
