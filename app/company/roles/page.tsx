import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { listAllOpenings, listApplications } from "@/lib/hiring/openings";
import { CareersAdmin } from "@/components/careers/CareersAdmin";

export const metadata: Metadata = { title: "Roles — Company — Capabilio AI" };

export default async function CompanyRolesPage() {
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx || ctx.kind !== "company") redirect("/company");
  const service = createServiceClient();
  const [openings, applications] = await Promise.all([listAllOpenings(service, ctx.institutionId), listApplications(service, ctx.institutionId)]);
  return (
    <div>
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Roles</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Post a role and signed-in Capabilio students can apply with their Skill Passport attached.</p>
      <div className="pt-6"><CareersAdmin company openings={openings} applications={applications} /></div>
    </div>
  );
}
