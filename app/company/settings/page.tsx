import type { Metadata } from "next";
import { Building2, Database, FileText, ShieldCheck, User } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { SettingsLink, SettingsGroup } from "@/components/org/SettingsLink";
import { StatusPill } from "@/components/settings/SettingsCard";

export const metadata: Metadata = { title: "Settings — Company — Capabilio AI" };

export default async function CompanySettingsOverview() {
  const { supabase } = await orgPageContext();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const twoStepOn = Boolean(factors?.totp.some((f) => f.status === "verified"));

  return (
    <div className="flex flex-col gap-7">
      <SettingsGroup title="Company">
        <SettingsLink href="/company/settings/organization" icon={Building2} title="Company profile" description="Name, public page address and your company ID." />
        <SettingsLink href="/company/profile" icon={Building2} title="Edit company page" description="Logo, cover, about and the details people see on your public page." />
      </SettingsGroup>

      <SettingsGroup title="Your account">
        <SettingsLink href="/company/settings/account" icon={User} title="Account" description="Your name, sign-in email and role." />
        <SettingsLink
          href="/company/settings/security"
          icon={ShieldCheck}
          title="Security"
          description="Two-step verification, password and where you are signed in."
          status={<StatusPill tone={twoStepOn ? "on" : "warn"}>{twoStepOn ? "Two-step on" : "Two-step off"}</StatusPill>}
        />
        <SettingsLink href="/company/settings/privacy" icon={Database} title="Privacy & data" description="What you can see about candidates, and a download of your data." />
      </SettingsGroup>

      <SettingsGroup title="Legal">
        <SettingsLink href="/terms" icon={FileText} title="Terms of Service" description="The rules for using Capabilio." />
        <SettingsLink href="/privacy" icon={FileText} title="Privacy Policy" description="What we collect, why, and your rights." />
      </SettingsGroup>
    </div>
  );
}
