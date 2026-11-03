import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { listOrgFollowers } from "@/lib/org/followers";
import { FollowersTable } from "@/components/company/FollowersTable";

export const metadata: Metadata = { title: "Followers — Company — Capabilio AI" };

export default async function CompanyFollowersPage() {
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx || ctx.kind !== "company") redirect("/company");
  const page = await listOrgFollowers(createServiceClient(), user.id, ctx.institutionId, null);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Followers</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">People who follow your company page. You can see their names and when they followed, never their email.</p>
      <div className="pt-6"><FollowersTable slug={ctx.institutionSlug} initial={page.people} total={page.total} nextCursor={page.nextCursor} /></div>
    </div>
  );
}
