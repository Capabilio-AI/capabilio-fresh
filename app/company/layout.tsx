import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getOrgContext } from "@/lib/org/context";
import { companyNavGroups } from "@/lib/company/nav";
import { ROLE_LABEL } from "@/lib/org/nav";
import { OrgShell } from "@/components/org/OrgShell";
import { OrgTheme } from "@/components/org/OrgTheme";

/** Every /company page: signed in AND an ACTIVE company membership. Pending, revoked and college accounts never render this. */
export default async function CompanyLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx) redirect("/login?path=organisation");
  if (ctx.kind !== "company") redirect(ctx.kind === "student" ? "/dashboard" : "/org");
  return (
    <OrgTheme workspace>
      <OrgShell variant="company" approved institutionName={ctx.institutionName} roleLabel={ROLE_LABEL[ctx.role] ?? ctx.role} groups={companyNavGroups()}>
        {children}
      </OrgShell>
    </OrgTheme>
  );
}
