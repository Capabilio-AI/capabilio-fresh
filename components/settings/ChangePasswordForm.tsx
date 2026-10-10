"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/login/PasswordField";

const MIN_PASSWORD_LENGTH = 8;

/** Changes the signed-in student's password directly. The current password is checked first, then Supabase Auth stores the new one. */
export function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setDone(false);
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (next !== confirm) return setError("The new passwords don't match.");
    if (next === current) return setError("Choose a password different from your current one.");

    setSaving(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (verifyError) {
      setSaving(false);
      return setError("Your current password is incorrect.");
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (updateError) return setError("Couldn't update your password. Please try again.");
    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <PasswordField label="Current password" value={current} onChange={setCurrent} placeholder="Your current password" autoComplete="current-password" />
      <PasswordField label="New password" value={next} onChange={setNext} placeholder="At least 8 characters" autoComplete="new-password" />
      <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} placeholder="Repeat the new password" autoComplete="new-password" error={error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || !current || !next || !confirm} className="inline-flex items-center gap-2 rounded-lg bg-[var(--m-ink)] px-4 py-2 font-lp-body text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50">
          {saving && <Loader2 size={14} className="animate-spin" aria-hidden />}
          {saving ? "Updating…" : "Update password"}
        </button>
        {done && <p role="status" className="font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)]">Password updated.</p>}
      </div>
    </form>
  );
}
