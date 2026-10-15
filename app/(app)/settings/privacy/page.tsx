import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { canSelfDelete } from "@/lib/settings/deletion";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { PulsePrivacy } from "@/components/settings/PulsePrivacy";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { PassportShareToggle } from "@/components/profile/PassportShareToggle";
import { BTN_QUIET } from "@/components/settings/ui";

export const metadata: Metadata = { title: "Privacy and data — Capabilio AI" };

export default async function PrivacySettingsPage() {
  const { supabase, user } = await requireAuthedUser();
  const [{ data: profile }, { data: role }] = await Promise.all([
    supabase.from("profiles").select("passport_public").eq("id", user.id).single(),
    createServiceClient().from("profiles").select("primary_role").eq("id", user.id).single(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard id="pulse-h" title="Pulse visibility" description="What other people can see of you on Pulse.">
        <PulsePrivacy />
      </SettingsCard>

      <SettingsCard id="passport-h" title="Public skill passport" description="When on, anyone who scans your passport QR or opens its link sees your passport. When off, the page is private.">
        <PassportShareToggle initial={profile?.passport_public ?? false} />
        <Link href="/dashboard/passport" className="mt-3 inline-block font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline">Open your passport →</Link>
      </SettingsCard>

      <SettingsCard id="access-h" title="Who can see your data" description="Your assessment answers, Vault and capability data are yours. Staff at your institution can see your ELO rating, your target career and counts of your activity, and anything else only where their role's permissions explicitly allow it." />

      <SettingsCard id="export-h" title="Download your data" description="A JSON file with your profile, assessments, Vault, roadmap, posts and the other records tied to your account.">
        <a href="/api/account/export" download className={BTN_QUIET}>
          <Download size={15} aria-hidden /> Download my data
        </a>
      </SettingsCard>

      <DeleteAccountCard allowed={canSelfDelete(role?.primary_role)} />
    </div>
  );
}
