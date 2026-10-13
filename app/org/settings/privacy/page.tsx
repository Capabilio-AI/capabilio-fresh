import type { Metadata } from "next";
import { Download } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { BTN_QUIET } from "@/components/settings/ui";

export const metadata: Metadata = { title: "Privacy & data — Settings — Capabilio AI" };

export default async function OrgPrivacySettingsPage() {
  await orgPageContext();
  return (
    <div className="flex flex-col gap-5">
      <SettingsCard
        id="access-h"
        title="Student data and your access"
        description="You can open a student's records only through the pages your role is allowed to use, and only for students of your own organisation. An administrator decides what each person can open on the Team & access page."
      />

      <SettingsCard id="export-h" title="Download your data" description="A JSON file with your profile, memberships, posts, messages and the other records tied to your account.">
        <a href="/api/account/export" download className={BTN_QUIET}>
          <Download size={15} aria-hidden /> Download my data
        </a>
      </SettingsCard>

      <SettingsCard id="delete-h" title="Delete account or organisation" description="Deleting a staff account or an organisation also removes access for everyone who depends on it, so it isn't self-serve yet. Ask a Capabilio administrator." />
    </div>
  );
}
