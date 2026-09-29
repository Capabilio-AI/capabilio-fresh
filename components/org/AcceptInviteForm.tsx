"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/login/PasswordField";

const MIN = 8;

/** The invitee chooses their name and password; the email and the access come from the invitation itself. */
export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (fullName.trim().length < 2) return setError("Enter your full name.");
    if (password.length < MIN) return setError(`Password must be at least ${MIN} characters.`);
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      const res = await fetch("/api/invite/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, fullName: fullName.trim(), password }) });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) return setError(json?.error ?? "Something went wrong. Please try again.");
      const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
      if (signInError) return router.push("/login?path=organisation");
      router.push("/org");
      router.refresh();
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
      <label className="block text-[11.5px] font-bold text-app-muted">
        Email
        <input value={email} readOnly className="o-input mt-1.5 opacity-70" aria-readonly="true" />
      </label>
      <label className="block text-[11.5px] font-bold text-app-muted">
        Your full name *
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required className="o-input mt-1.5" />
      </label>
      <PasswordField value={password} onChange={setPassword} label="Create a password" />
      <PasswordField value={confirm} onChange={setConfirm} label="Confirm password" error={error} />
      <button type="submit" className="o-btn !py-3" disabled={busy}>
        {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Create account and open workspace
      </button>
    </form>
  );
}
