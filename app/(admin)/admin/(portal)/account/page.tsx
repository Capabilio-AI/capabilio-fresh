import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/db";
import { ROLE_LABEL, ROLE_SUMMARY } from "@/lib/admin/permissions";
import { PasswordForm } from "@/components/admin/PasswordForm";
import { Chip, PageHeader, Section } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Your own account: your role, and changing your password. A password an owner issued has to be changed here before anything else opens. */
export default async function AdminAccount({ searchParams }: { searchParams: Promise<{ change?: string }> }) {
  const admin = await requireAdminPage(undefined, { allowMustChange: true });
  const { change } = await searchParams;
  const forced = admin.mustChangePassword;
  return (
    <div>
      <PageHeader eyebrow="Your account" title={forced ? "Choose your own password" : "Account and password"} intro={forced ? "An owner created this account with a one-time password. Pick your own now. Nothing else in the console opens until you do." : admin.email ?? undefined} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Change password"><PasswordForm forced={forced || change === "1"} /></Section>
        <div className="flex flex-col gap-4">
          <Section title="Your role"><p className="flex items-center gap-2 font-lp-body text-[14px] text-[var(--m-ink)]"><Chip tone="plain">{ROLE_LABEL[admin.role]}</Chip>{admin.hideContacts && <Chip tone="hold">contacts hidden</Chip>}</p><p className="mt-2 font-lp-body text-[13px] text-[var(--m-muted)]">{ROLE_SUMMARY[admin.role]}</p></Section>
          <Section title="Two-step verification" hint="Strongly recommended for admin accounts">
            <p className="font-lp-body text-[13px] leading-relaxed text-[var(--m-muted)]">Turn on an authenticator app in your account settings. After that, signing in to this console asks for a 6-digit code as well as the password.</p>
            <Link href="/settings" className="mt-3 inline-flex rounded-full border border-[var(--m-rule)] px-4 py-2 font-lp-body text-[13px] font-bold text-[var(--m-ink)] hover:border-[var(--m-ink)]">Open account settings</Link>
          </Section>
        </div>
      </div>
    </div>
  );
}
