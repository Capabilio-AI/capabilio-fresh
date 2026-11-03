import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { untyped, type OrgProfileRow } from "@/lib/org/db";
import { ProfileEditor, type CompanyProfileValues } from "@/components/company/ProfileEditor";

export const metadata: Metadata = { title: "Profile — Company — Capabilio AI" };

interface CompanyRow {
  mission: string | null;
  industry: string | null;
  size_band: CompanyProfileValues["sizeBand"];
  accent: string | null;
  culture: string[];
  perks: string[];
  tech_stack: string[];
}

export default async function CompanyProfilePage() {
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx || ctx.kind !== "company") redirect("/company");
  const service = createServiceClient();
  const db = untyped(service);
  const [org, company, inst] = await Promise.all([
    db.from("org_profiles").select("*").eq("institution_id", ctx.institutionId).maybeSingle(),
    db.from("company_profiles").select("*").eq("institution_id", ctx.institutionId).maybeSingle(),
    service.from("institutions").select("city").eq("id", ctx.institutionId).maybeSingle(),
  ]);
  const o = (org.data as OrgProfileRow | null) ?? null;
  const c = (company.data as CompanyRow | null) ?? null;
  const values: CompanyProfileValues = {
    tagline: o?.tagline ?? "",
    about: o?.bio ?? "",
    websiteUrl: o?.website_url ?? "",
    foundedYear: o?.founded_year ? String(o.founded_year) : "",
    city: inst.data?.city ?? "",
    isPublic: o?.is_public ?? false,
    mission: c?.mission ?? "",
    industry: c?.industry ?? "",
    sizeBand: c?.size_band ?? null,
    accent: c?.accent ?? "#3a45c4",
    culture: c?.culture ?? [],
    perks: c?.perks ?? [],
    techStack: c?.tech_stack ?? [],
  };
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Company profile</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">What students and recruiters see on your public page.</p>
      <div className="pt-6">
        <ProfileEditor values={values} companyName={ctx.institutionName} slug={ctx.institutionSlug} logoUrl={o?.logo_url ?? null} coverUrl={o?.cover_image_url ?? null} />
      </div>
    </div>
  );
}
