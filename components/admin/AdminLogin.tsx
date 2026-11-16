"use client";

import { FormEvent, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MfaStep } from "@/components/login/MfaStep";
import { verifyTotpOnly } from "@/components/login/auth";

const FIELD = "w-full rounded-xl border border-[var(--m-rule)] bg-white px-4 py-3 font-lp-body text-[15px] text-[var(--m-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]";

/** Capabilio's own sign-in for the console. It does nothing about colleges or companies: it signs in, asks for the authenticator code if the account has one, and opens /admin. */
export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err || !data.user) { setError(err?.message.toLowerCase().includes("invalid") ? "That email or password is not right." : "Could not sign in. Try again."); return; }
    const factor = (data.user.factors ?? []).find((f) => f.factor_type === "totp" && f.status === "verified");
    if (factor) { setFactorId(factor.id); return; }
    window.location.assign("/admin");
  }

  if (factorId) {
    return (
      <MfaStep
        verify={async (code) => verifyTotpOnly(factorId, code)}
        onVerified={() => window.location.assign("/admin")}
        onCancel={() => { setFactorId(null); setPassword(""); void createClient().auth.signOut(); }}
        cancelLabel="Use a different account"
      />
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5 font-lp-body text-[13px] font-bold text-[var(--m-ink)]">Admin email
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1.5 font-lp-body text-[13px] font-bold text-[var(--m-ink)]">Password
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} />
      </label>
      {error && <p role="alert" className="font-lp-body text-[13px] font-semibold text-[#8e1228]">{error}</p>}
      <button type="submit" disabled={busy || !email || !password} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--m-ink)] px-6 py-3 font-lp-body text-[15px] font-bold text-white disabled:opacity-40">
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}Open the console
      </button>
    </form>
  );
}
