import type { Metadata } from "next";
import { Mail, ShieldCheck, User, UserCog } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { ROLE_LABEL } from "@/lib/org/nav";
import { EditableNameForm } from "@/components/settings/EditableNameForm";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SignOutButton } from "@/components/settings/SignOutButton";

export const metadata: Metadata = { title: "Account — Settings — Capabilio AI" };

export default async function OrgAccountSettingsPage() {
  const { ctx, supabase } = await orgPageContext();
  const [{ data: userData }, { data: profile }] = await Promise.all([supabase.auth.getUser(), supabase.from("profiles").select("full_name").eq("id", ctx.userId).single()]);

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard id="profile-h" title="Profile" description="How your name appears to your colleagues and on your posts." bare>
        <SettingsRow icon={User} title="Full name" description="Shown to your team.">
          <EditableNameForm initialName={profile?.full_name ?? ""} />
        </SettingsRow>
        <SettingsRow icon={UserCog} title="Role" description={`${ROLE_LABEL[ctx.role] ?? ctx.role} at ${ctx.institutionName}. An administrator changes roles on the Team & access page.`} />
      </SettingsCard>

      <SettingsCard id="acct-h" title="Sign-in email" bare>
        <SettingsRow icon={Mail} title={userData.user?.email ?? "No email on file"} description="This is the address you sign in with. To change it, contact support." />
      </SettingsCard>

      <SettingsCard id="session-h" title="This session" bare>
        <SettingsRow icon={ShieldCheck} title="Sign out" description="End your session on this device.">
          <SignOutButton />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
