"use client";

import { FormEvent, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "./PasswordField";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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

    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError("This reset link has expired or already been used. Request a new one.");
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <div className="pt-1 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lp-surface-subtle text-lp-accent-indigo">
          <ShieldCheck size={20} />
        </div>
        <h1 className="mt-4 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
          Password updated
        </h1>
        <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-text-muted">
          Your password has been changed. You can now sign in with your new password.
        </p>
        <a
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded bg-lp-text-ink py-3 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="pt-1">
      <h1 className="font-lp-display text-lp-headline-md font-semibold tracking-tight text-lp-text-ink">
        Set a new password
      </h1>
      <p className="mt-1.5 font-lp-body text-lp-body-sm text-lp-text-muted">
        Choose a new password for your Capabilio AI account.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        <PasswordField value={password} onChange={setPassword} label="New password" />
        <PasswordField
          value={confirmPassword}
          onChange={setConfirmPassword}
          label="Confirm new password"
          error={error}
        />

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded bg-lp-text-ink py-3.5 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </button>
      </div>
    </form>
  );
}
