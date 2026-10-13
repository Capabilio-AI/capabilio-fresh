import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Mail, School, ShieldCheck, User } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { formatAcademicYear } from "@/lib/career/academic-year";
import { EditableNameForm } from "@/components/settings/EditableNameForm";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SignOutButton } from "@/components/settings/SignOutButton";

export const metadata: Metadata = { title: "Account settings — Capabilio AI" };

const LINK = "font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline";

export default async function SettingsPage() {
  const { supabase, user } = await requireAuthedUser();
  const viewer = await getViewerSummary(supabase, user.id);

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard id="profile-h" title="Profile" description="How you appear across your dashboard and Vault." bare>
        <SettingsRow icon={User} title="Full name" description="Shown across your dashboard and Vault.">
          <EditableNameForm initialName={viewer.fullName ?? ""} />
        </SettingsRow>
        <SettingsRow icon={User} title="Photo and headline" description="Manage how you appear to others.">
          <Link href="/profile" className={LINK}>Go to profile →</Link>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard id="acct-h" title="Sign-in email" bare>
        <SettingsRow icon={Mail} title={viewer.email ?? "No email on file"} description="This is the address you sign in with. To change it, contact support.">
          <Link href="/settings/security" className={LINK}>Security →</Link>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard id="acad-h" title="Academic" bare>
        <SettingsRow icon={School} title="Institution" description={viewer.collegeName ?? "Not set"} />
        <SettingsRow
          icon={GraduationCap}
          title="Branch and year"
          description={
            [viewer.branch, formatAcademicYear(viewer.direction?.academicYear?.year ?? null, viewer.direction?.startYear ?? null, viewer.direction?.endYear ?? null)].filter(Boolean).join(" · ") || "Not set"
          }
        >
          <Link href="/dashboard/vault" className={LINK}>Manage →</Link>
        </SettingsRow>
        <SettingsRow icon={GraduationCap} title="Career direction" description="Job, higher studies, entrepreneurship, or not sure yet. Change it any time.">
          <Link href="/settings/direction" className={LINK}>Open →</Link>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard id="session-h" title="This session" bare>
        <SettingsRow icon={ShieldCheck} title="Sign out" description="End your session on this device.">
          <SignOutButton />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
