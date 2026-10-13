import type { Metadata } from "next";
import { Building2, Database, KeyRound, MessagesSquare, School, ShieldCheck, User, Users } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { can } from "@/lib/org/roles";
import { SettingsLink, SettingsGroup } from "@/components/org/SettingsLink";
import { StatusPill } from "@/components/settings/SettingsCard";

export const metadata: Metadata = { title: "Settings — Capabilio AI" };

// Listed so nobody hunts for them: none of these exist in the product yet.
const NOT_YET = ["Single sign-on", "Billing and invoices", "Audit log", "Integrations and API keys", "Notification preferences"];

export default async function OrgSettingsOverview() {
  const { ctx, supabase } = await orgPageContext();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const twoStepOn = Boolean(factors?.totp.some((f) => f.status === "verified"));
  const members = ctx.permissions.has("members");

  return (
    <div className="flex flex-col gap-7">
      <SettingsGroup title="Organisation">
        <SettingsLink href="/org/settings/organization" icon={Building2} title="Organisation profile" description="Name, type, public page and your organisation ID." />
        {can(ctx, "manageProfile") && <SettingsLink href="/org/college?edit=1" icon={School} title="College page" description="Logo, cover image and the details people see on your public page." />}
      </SettingsGroup>

      {members && (
        <SettingsGroup title="Members & access">
          <SettingsLink href="/org/team" icon={Users} title="Team & access" description="Invite staff, approve registrations, and choose what each person can open." />
          {ctx.permissions.has("chat") && <SettingsLink href="/org/chat" icon={MessagesSquare} title="Team chat" description="Channels and messages for your staff." />}
        </SettingsGroup>
      )}

      <SettingsGroup title="Your account">
        <SettingsLink href="/org/settings/account" icon={User} title="Account" description="Your name, sign-in email and role." />
        <SettingsLink
          href="/org/settings/security"
          icon={ShieldCheck}
          title="Security"
          description="Two-step verification, password and where you are signed in."
          status={<StatusPill tone={twoStepOn ? "on" : "warn"}>{twoStepOn ? "Two-step on" : "Two-step off"}</StatusPill>}
        />
        <SettingsLink href="/org/settings/privacy" icon={Database} title="Privacy & data" description="What staff can see, and a download of your data." />
      </SettingsGroup>

      <section aria-labelledby="soon-h" className="rounded-2xl border border-dashed border-[var(--m-soft)]! px-5 py-4 sm:px-6">
        <h2 id="soon-h" className="flex items-center gap-2 text-[13.5px] font-bold text-[var(--m-ink)]">
          <KeyRound size={15} aria-hidden className="text-[var(--m-muted)]" /> Not available yet
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--m-muted)]">{NOT_YET.join(" · ")}. These are planned, and will appear here when they work.</p>
      </section>
    </div>
  );
}
