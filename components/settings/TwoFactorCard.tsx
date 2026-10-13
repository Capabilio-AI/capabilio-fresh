"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SettingsCard, StatusPill } from "./SettingsCard";
import { BTN_DANGER, BTN_PRIMARY, BTN_QUIET, INPUT } from "./ui";

const CODE_LENGTH = 6;
const FACTOR_NAME = "Authenticator app";

type Phase = { name: "idle" } | { name: "enrolling"; factorId: string; qr: string; secret: string } | { name: "disabling" };

function CodeField({ id, value, onChange, error }: { id: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-lp-body text-[13px] font-bold text-[var(--m-ink)]">6-digit code</label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : undefined}
        placeholder="000000"
        className={`${INPUT} max-w-[200px] text-center font-lp-mono text-[18px] tracking-[0.3em]`}
      />
      {error && <p id={`${id}-err`} role="alert" className="mt-1.5 font-lp-body text-[12.5px] text-[#b42318]">{error}</p>}
    </div>
  );
}

/** Authenticator-app (TOTP) two-factor. Sign-in and every server route enforce it once a factor is verified. */
export function TwoFactorCard({ verifiedFactorId }: { verifiedFactorId: string | null }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const enabled = Boolean(verifiedFactorId);

  function reset() {
    setPhase({ name: "idle" });
    setCode("");
    setError(undefined);
  }

  async function startEnrol() {
    setBusy(true);
    setError(undefined);
    const supabase = createClient();
    // An abandoned attempt leaves an unverified factor that would block the name; clear those first.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error: enrolError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: FACTOR_NAME });
    setBusy(false);
    if (enrolError || !data) return setError("Couldn't start setup. Please try again.");
    setPhase({ name: "enrolling", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnrol(e: FormEvent) {
    e.preventDefault();
    if (phase.name !== "enrolling") return;
    setBusy(true);
    setError(undefined);
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId: phase.factorId, code });
    setBusy(false);
    if (verifyError) {
      setCode("");
      return setError("That code didn't match. Wait for a fresh one and try again.");
    }
    // Any password-only session that already exists (a thief's, say) must not outlive turning this on.
    await createClient().auth.signOut({ scope: "others" });
    reset();
    router.refresh();
  }

  async function confirmDisable(e: FormEvent) {
    e.preventDefault();
    if (!verifiedFactorId) return;
    setBusy(true);
    setError(undefined);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: verifiedFactorId, code });
    if (verifyError) {
      setBusy(false);
      setCode("");
      return setError("That code didn't match. Wait for a fresh one and try again.");
    }
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId });
    setBusy(false);
    if (removeError) return setError("Couldn't turn off two-step verification. Please try again.");
    reset();
    router.refresh();
  }

  return (
    <SettingsCard
      id="tfa-h"
      title="Two-step verification"
      description="Adds a 6-digit code from an authenticator app to every sign-in, so a stolen password alone can't open your account."
      status={<StatusPill tone={enabled ? "on" : "off"}>{enabled ? "On" : "Off"}</StatusPill>}
    >
      {phase.name === "idle" && (
        <>
          {enabled ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-lp-body text-[13.5px] text-[var(--m-ink)]">
                <ShieldCheck size={16} aria-hidden className="text-[#0f6b3c]" /> Authenticator app is protecting this account.
              </p>
              <button type="button" className={BTN_QUIET} onClick={() => setPhase({ name: "disabling" })}>Turn off</button>
            </div>
          ) : (
            <div>
              <button type="button" className={BTN_PRIMARY} onClick={startEnrol} disabled={busy}>
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                Set up authenticator app
              </button>
              {error && <p role="alert" className="mt-2 font-lp-body text-[12.5px] text-[#b42318]">{error}</p>}
            </div>
          )}
          <p className="mt-4 max-w-[62ch] font-lp-body text-[12.5px] leading-relaxed text-[var(--m-muted)]">
            Capabilio doesn&apos;t issue backup codes yet. If you lose your authenticator app you will not be able to sign in, so use an app that backs itself up.
          </p>
        </>
      )}

      {phase.name === "enrolling" && (
        <form onSubmit={confirmEnrol} className="flex flex-col gap-5">
          <ol className="flex flex-col gap-4 font-lp-body text-[13.5px] text-[var(--m-ink)]">
            <li>
              <span className="font-bold">1. Scan this code</span> with an authenticator app such as Google Authenticator, 1Password or Authy.
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI from Supabase, not an optimisable asset */}
                <img src={phase.qr} alt="QR code for your authenticator app" width={148} height={148} className="rounded-lg border border-[var(--m-rule)]! bg-[#fff] p-2" />
                <div className="min-w-0">
                  <p className="text-[12.5px] text-[var(--m-muted)]">Can&apos;t scan? Enter this key instead:</p>
                  <code className="mt-1 block break-all rounded-md bg-[var(--m-ground)] px-2.5 py-1.5 font-lp-mono text-[12.5px] text-[var(--m-ink)]">{phase.secret}</code>
                </div>
              </div>
            </li>
            <li>
              <span className="mb-2 block font-bold">2. Enter the code it shows</span>
              <CodeField id="tfa-enrol-code" value={code} onChange={setCode} error={error} />
            </li>
          </ol>
          <div className="flex gap-2">
            <button type="submit" className={BTN_PRIMARY} disabled={busy || code.length !== CODE_LENGTH}>
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
              Turn on
            </button>
            <button type="button" className={BTN_QUIET} onClick={async () => { await createClient().auth.mfa.unenroll({ factorId: phase.factorId }); reset(); }}>Cancel</button>
          </div>
        </form>
      )}

      {phase.name === "disabling" && (
        <form onSubmit={confirmDisable} className="flex flex-col gap-4">
          <p className="max-w-[60ch] font-lp-body text-[13.5px] text-[var(--m-ink)]">Enter a current code to confirm it&apos;s you. Anyone with your password will be able to sign in without a code.</p>
          <CodeField id="tfa-off-code" value={code} onChange={setCode} error={error} />
          <div className="flex gap-2">
            <button type="submit" className={BTN_DANGER} disabled={busy || code.length !== CODE_LENGTH}>
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
              Turn off two-step verification
            </button>
            <button type="button" className={BTN_QUIET} onClick={reset}>Keep it on</button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
