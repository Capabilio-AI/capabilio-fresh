"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import type { CodeCheck } from "./auth";

const CODE_LENGTH = 6;

/** The second step of sign-in for accounts with an authenticator app. */
export function MfaStep({ verify, onVerified, onCancel, cancelLabel = "Use a different account" }: { verify: (code: string) => Promise<CodeCheck>; onVerified?: () => void; onCancel: () => void; cancelLabel?: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [checking, setChecking] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setChecking(true);
    const result = await verify(code);
    setChecking(false);
    if (result === "invalid") {
      setCode("");
      return setError("That code didn't work. Codes change every 30 seconds, so try the current one.");
    }
    if (result === "error") return setError("Something went wrong checking that code. Please try again.");
    onVerified?.();
  }

  return (
    <>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lp-surface-container-low text-lp-accent-indigo">
        <ShieldCheck size={20} aria-hidden />
      </span>
      <h1 className="mt-4 font-lp-display text-lp-headline-md font-semibold tracking-tight text-lp-text-ink">Check it&apos;s you</h1>
      <p className="mt-1.5 font-lp-body text-lp-body-sm text-lp-text-muted">Open your authenticator app and enter the 6-digit code for Capabilio.</p>

      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="mfa-code" className="mb-2 block font-lp-body text-lp-body-sm font-medium text-lp-on-surface-variant">Authentication code</label>
          <input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "mfa-error" : undefined}
            placeholder="000000"
            className="w-full rounded border border-lp-border-hairline bg-lp-surface-card px-4 py-3 text-center font-lp-mono text-[22px] tracking-[0.4em] text-lp-text-ink placeholder:text-lp-text-muted/50 focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
          />
          {error && <p id="mfa-error" role="alert" className="mt-2 font-lp-mono text-lp-label-sm text-lp-error">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={checking || code.length !== CODE_LENGTH}
          className="flex w-full items-center justify-center gap-2 rounded bg-lp-text-ink py-3.5 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {checking ? <><Loader2 size={16} className="animate-spin" aria-hidden />Checking…</> : <>Verify and sign in<ArrowRight size={16} aria-hidden /></>}
        </button>
        <button type="button" onClick={onCancel} className="font-lp-mono text-lp-label-sm font-medium text-lp-text-muted underline-offset-2 hover:text-lp-accent-indigo hover:underline">
          {cancelLabel}
        </button>
      </form>
    </>
  );
}
