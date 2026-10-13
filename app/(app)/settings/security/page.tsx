import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { TwoFactorCard } from "@/components/settings/TwoFactorCard";
import { SessionsCard } from "@/components/settings/SessionsCard";

export const metadata: Metadata = { title: "Security — Capabilio AI" };

function Protection({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  const Icon = done ? Check : Minus;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-[#e3f4ea] text-[#0f6b3c]" : "bg-[var(--m-ground)] text-[var(--m-muted)]"}`}>
        <Icon size={13} strokeWidth={3} />
      </span>
      <p className="font-lp-body text-[14px] text-[var(--m-ink)]">
        <span className="font-bold">{label}</span>
        <span className="text-[var(--m-muted)]"> — {detail}</span>
      </p>
    </li>
  );
}

export default async function SecuritySettingsPage() {
  const { supabase } = await requireAuthedUser();
  const [{ data: userData }, { data: factors }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.listFactors()]);
  const user = userData.user;
  const verifiedFactor = factors?.totp.find((f) => f.status === "verified") ?? null;

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard id="prot-h" title="Account protection">
        <ul className="divide-y divide-[var(--m-rule)]!">
          <Protection done={Boolean(user?.email_confirmed_at)} label="Email verified" detail={user?.email_confirmed_at ? "your sign-in address is confirmed." : "your sign-in address isn't confirmed yet."} />
          <Protection done label="Password set" detail="change it any time below." />
          <Protection done={Boolean(verifiedFactor)} label="Two-step verification" detail={verifiedFactor ? "on, with an authenticator app." : "off. Turn it on to protect against a stolen password."} />
        </ul>
      </SettingsCard>

      <TwoFactorCard verifiedFactorId={verifiedFactor?.id ?? null} />

      <SettingsCard id="pw-h" title="Password" description="Enter your current password, then choose a new one. You stay signed in on this device.">
        <ChangePasswordForm email={user?.email ?? ""} />
      </SettingsCard>

      <SessionsCard lastSignInAt={user?.last_sign_in_at ?? null} />
    </div>
  );
}
