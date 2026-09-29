"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { CardChrome } from "@/components/login/CardChrome";
import { PasswordField } from "@/components/login/PasswordField";
import { MIN_PASSWORD_LENGTH, type InstitutionDesignation, type OrgType } from "@/lib/org/signup";

const FIELD_LABEL = "mb-2 block font-lp-body text-lp-body-sm font-medium text-lp-on-surface-variant";
const FIELD_INPUT =
  "w-full rounded border border-lp-border-hairline bg-lp-surface-card px-4 py-3 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted transition-colors focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25";

const DESIGNATIONS: { value: InstitutionDesignation; label: string }[] = [
  { value: "tpo", label: "Training & Placement Officer (TPO)" },
  { value: "principal", label: "Principal" },
  { value: "vice_principal", label: "Vice Principal" },
  { value: "hod", label: "Head of Department" },
];

const CONFIRMATION: Record<OrgType, { title: string; body: string }> = {
  institution: {
    title: "Application received",
    body: "Check your email to confirm your address. Your institution account then stays pending until we manually verify it — you can sign in at any time to see its status.",
  },
  company: {
    title: "Thanks — we'll be in touch",
    body: "Check your email to confirm your address. Company accounts aren't open yet; we've recorded your details and will contact you.",
  },
};

export function OrganisationSignupForm() {
  const [orgType, setOrgType] = useState<OrgType>("institution");
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState<InstitutionDesignation>("tpo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [doneType, setDoneType] = useState<OrgType | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== confirmPassword) return setError("Passwords don't match.");
    if (!agreed) return setError("You must agree to the Terms of Service and Privacy Policy to continue.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/org/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgType,
          orgName,
          fullName,
          email,
          password,
          ...(orgType === "institution" ? { designation } : {}),
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) return setError(body?.error ?? "Something went wrong. Please try again.");
      setDoneType(orgType);
    } catch {
      setError("Connection problem. Please check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (doneType) {
    const copy = CONFIRMATION[doneType];
    return (
      <CardChrome label="capabilio / organisation">
        <div className="pt-1 text-center" data-testid="org-confirmation">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lp-surface-subtle text-lp-accent-indigo">
            <CheckCircle2 size={20} />
          </div>
          <h1 className="mt-4 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">{copy.title}</h1>
          <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-text-muted">{copy.body}</p>
          <a
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded bg-lp-text-ink py-3 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card hover:bg-lp-inverse-surface"
          >
            Go to sign in
          </a>
        </div>
      </CardChrome>
    );
  }

  return (
    <CardChrome label="capabilio / organisation">
      <h1 className="font-lp-display text-lp-headline-md font-semibold tracking-tight text-lp-text-ink">Register your organisation</h1>
      <p className="mt-1.5 font-lp-body text-lp-body-sm text-lp-text-muted">
        Connect, assess, develop, and understand your people. New organisations are reviewed manually before activation.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5" noValidate>
        <fieldset>
          <legend className={FIELD_LABEL}>Organisation type</legend>
          <div className="grid grid-cols-2 gap-3">
            {(["institution", "company"] as const).map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded border border-lp-border-hairline px-3 py-2.5 font-lp-body text-lp-body-sm text-lp-text-ink has-[:checked]:border-lp-accent-indigo">
                <input type="radio" name="org-type" checked={orgType === t} onChange={() => setOrgType(t)} className="accent-[var(--lp-accent-indigo)]" />
                {t === "institution" ? "College / University" : "Company"}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="org-name" className={FIELD_LABEL}>
            {orgType === "institution" ? "Institution name" : "Company name"}
          </label>
          <input id="org-name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} className={FIELD_INPUT} autoComplete="organization" />
        </div>

        <div>
          <label htmlFor="org-full-name" className={FIELD_LABEL}>Your name</label>
          <input id="org-full-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={FIELD_INPUT} autoComplete="name" />
        </div>

        {orgType === "institution" && (
          <div>
            <label htmlFor="org-designation" className={FIELD_LABEL}>Your designation</label>
            <select id="org-designation" value={designation} onChange={(e) => setDesignation(e.target.value as InstitutionDesignation)} className={FIELD_INPUT}>
              {DESIGNATIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="org-email" className={FIELD_LABEL}>Work email</label>
          <input id="org-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD_INPUT} autoComplete="email" />
        </div>

        <PasswordField value={password} onChange={setPassword} label="Password" />
        <PasswordField value={confirmPassword} onChange={setConfirmPassword} label="Confirm password" error={error} />

        <label className="flex items-start gap-2.5 font-lp-body text-lp-body-sm text-lp-on-surface-variant">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--lp-accent-indigo)]" />
          I agree to the Terms of Service and Privacy Policy.
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded bg-lp-text-ink py-3.5 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (<><Loader2 size={16} className="animate-spin" />Submitting…</>) : (<>Submit for approval<ArrowRight size={16} /></>)}
        </button>
      </form>

      <p className="mt-6 text-center font-lp-body text-lp-body-sm text-lp-text-muted">
        Already registered? <a href="/login" className="font-medium text-lp-accent-indigo hover:underline">Sign in</a>
      </p>
    </CardChrome>
  );
}
