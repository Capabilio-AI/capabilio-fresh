import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Lock, LogOut, Mail, School, ShieldCheck, User } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { EditableNameForm } from "@/components/settings/EditableNameForm";
import { SettingsRow, SettingsSection } from "@/components/settings/SettingsRow";
import { ChangePasswordButton } from "@/components/settings/ChangePasswordButton";
import { SignOutButton } from "@/components/settings/SignOutButton";

export const metadata: Metadata = { title: "Settings — Capabilio AI" };

export default async function SettingsPage() {
  const { supabase, user } = await requireAuthedUser();

  const viewer = await getViewerSummary(supabase, user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Settings</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Manage your account, profile, and security.</p>

      <div className="mt-6 flex flex-col gap-6">
        <SettingsSection title="Profile">
          <SettingsRow icon={User} title="Full name" description="Shown across your dashboard and Vault.">
            <EditableNameForm initialName={viewer.fullName ?? ""} />
          </SettingsRow>
          <SettingsRow icon={User} title="Profile picture & headline" description="Manage how you appear to others.">
            <Link href="/profile" className="font-lp-mono text-[11.5px] text-app-blue hover:underline">
              Go to profile →
            </Link>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Account">
          <SettingsRow icon={Mail} title="Email" description="Contact support to change your email.">
            <span className="font-lp-body text-[13px] text-app-charcoal">{viewer.email}</span>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Academic">
          <SettingsRow icon={School} title="Institution" description={viewer.collegeName ?? "Not set"} />
          <SettingsRow
            icon={GraduationCap}
            title="Branch & year"
            description={[viewer.branch, viewer.year].filter(Boolean).join(" · ") || "Not set"}
          >
            <Link href="/dashboard/education" className="font-lp-mono text-[11.5px] text-app-blue hover:underline">
              Manage →
            </Link>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Security">
          <SettingsRow icon={Lock} title="Password" description="We'll email you a link to set a new one.">
            <ChangePasswordButton email={viewer.email} />
          </SettingsRow>
          <SettingsRow icon={ShieldCheck} title="Data access" description="Only you can see your assessment, Vault, and capability data — staff at your institution can view it only where your role's permissions explicitly allow it." />
          <SettingsRow icon={LogOut} title="Sign out" description="End your session on this device." tone="warning">
            <SignOutButton />
          </SettingsRow>
        </SettingsSection>
      </div>
    </div>
  );
}
