import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getOrgContext } from "@/lib/org/context";
import { orgNavGroupsFor, ROLE_LABEL } from "@/lib/org/nav";
import { OrgShell } from "@/components/org/OrgShell";
import { OrgTheme } from "@/components/org/OrgTheme";

/** Every /org page: signed in AND an ACTIVE staff/admin/TPO membership. Pending or revoked accounts never render this. */
export default async function OrgLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx) redirect("/login?path=organisation");
  if (ctx.kind === "student") redirect("/dashboard");
  return (
    <OrgTheme workspace>
      <OrgShell institutionName={ctx.institutionName} roleLabel={ROLE_LABEL[ctx.role] ?? ctx.role} groups={orgNavGroupsFor(ctx.permissions)} publicHref={`/o/${ctx.institutionSlug}`}>
        {children}
      </OrgShell>
    </OrgTheme>
  );
}
