"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { CardChrome } from "./CardChrome";
import { CollegeAutocomplete, CollegeMatch } from "./CollegeAutocomplete";
import { PasswordField } from "./PasswordField";
import { signUp } from "./auth";
import { BranchOption, getBranches } from "./directory";

const MIN_PASSWORD_LENGTH = 8;

const YEAR_OPTIONS = [
  { value: 1, label: "1st year" },
  { value: 2, label: "2nd year" },
  { value: 3, label: "3rd year" },
  { value: 4, label: "4th year" },
  { value: 5, label: "5th year" },
];

const FIELD_LABEL = "mb-2 block font-lp-body text-lp-body-sm font-medium text-lp-on-surface-variant";
const FIELD_INPUT =
  "w-full rounded border border-lp-border-hairline bg-lp-surface-card px-4 py-3 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted transition-colors focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25";

export function SignupForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [selectedCollege, setSelectedCollege] = useState<CollegeMatch | null>(null);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!selectedCollege) {
      setBranchOptions([]);
      return;
    }
    let cancelled = false;
    getBranches(selectedCollege.college_type).then((options) => {
      if (!cancelled) {
        setBranchOptions(options);
        setBranch("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCollege]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setSubmitting(true);
    const outcome = await signUp({
      firstName,
      lastName,
      collegeName,
      branch,
      year: Number(year),
      email,
      password,
    });
    setSubmitting(false);

    if (outcome.status === "error") {
      setError(outcome.message);
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <CardChrome label="capabilio / create-account">
        <div className="pt-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lp-surface-subtle text-lp-accent-indigo">
            <CheckCircle2 size={20} />
          </div>
          <h1 className="mt-4 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
            Check your email
          </h1>
          <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-text-muted">
            We&apos;ve sent a confirmation link to <strong className="text-lp-text-ink">{email}</strong>.
            Confirm your account to continue your Capabilio AI journey.
          </p>
          <a
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded bg-lp-text-ink py-3 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface"
          >
            Back to sign in
          </a>
        </div>
      </CardChrome>
    );
  }

  return (
    <CardChrome label="capabilio / create-account">
      <h1 className="font-lp-display text-lp-headline-md font-semibold tracking-tight text-lp-text-ink">
        Create your account
      </h1>
      <p className="mt-1.5 font-lp-body text-lp-body-sm text-lp-text-muted">
        Start building your verified career profile.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5" noValidate>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="first-name" className={FIELD_LABEL}>
              First name
            </label>
            <input
              id="first-name"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ananya"
              autoComplete="given-name"
              className={FIELD_INPUT}
            />
          </div>
          <div>
            <label htmlFor="last-name" className={FIELD_LABEL}>
              Last name
            </label>
            <input
              id="last-name"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Rao"
              autoComplete="family-name"
              className={FIELD_INPUT}
            />
          </div>
        </div>

        <div>
          <label htmlFor="college-name" className={FIELD_LABEL}>
            College name
          </label>
          <CollegeAutocomplete
            id="college-name"
            value={collegeName}
            onChange={setCollegeName}
            onSelect={setSelectedCollege}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="branch-name" className={FIELD_LABEL}>
              Branch name
            </label>
            {branchOptions.length > 0 ? (
              <select
                id="branch-name"
                required
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className={FIELD_INPUT}
              >
                <option value="" disabled>
                  Select your branch
                </option>
                {branchOptions.map((option) => (
                  <option key={option.id} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="branch-name"
                type="text"
                required
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Computer Science"
                className={FIELD_INPUT}
              />
            )}
          </div>
          <div>
            <label htmlFor="year" className={FIELD_LABEL}>
              Year
            </label>
            <select
              id="year"
              required
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={FIELD_INPUT}
            >
              <option value="" disabled>
                Select your year
              </option>
              {YEAR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="signup-email" className={FIELD_LABEL}>
            Email address
          </label>
          <input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
            className={FIELD_INPUT}
          />
        </div>

        <PasswordField value={password} onChange={setPassword} label="Password" />
        <PasswordField
          value={confirmPassword}
          onChange={setConfirmPassword}
          label="Confirm password"
          error={error}
        />

        <label className="flex items-start gap-2.5 font-lp-body text-lp-body-sm text-lp-on-surface-variant">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-lp-border-strong bg-lp-surface-card text-lp-accent-indigo accent-[var(--lp-accent-indigo)] focus:ring-2 focus:ring-lp-accent-indigo/25"
          />
          I agree to the Terms of Service and Privacy Policy.
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded bg-lp-text-ink py-3.5 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center font-lp-body text-lp-body-sm text-lp-text-muted">
        Already have a Capabilio AI account?{" "}
        <a href="/login" className="font-medium text-lp-accent-indigo hover:underline">
          Sign in
        </a>
      </p>
    </CardChrome>
  );
}
