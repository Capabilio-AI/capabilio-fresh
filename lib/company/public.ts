import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { loadPublicOrg, loadVisiblePosts, type PublicOrg, type PublicPost } from "@/lib/org/public-org";
import { isAccepting } from "@/lib/hiring/format";
import { toOpening } from "@/lib/hiring/openings";
import type { Opening } from "@/lib/hiring/types";

export interface CompanyExtras {
  mission: string | null;
  industry: string | null;
  sizeBand: string | null;
  accent: string | null;
  culture: string[];
  perks: string[];
  techStack: string[];
}

export interface PublicCompany {
  org: PublicOrg;
  extras: CompanyExtras;
  roles: Opening[];
  posts: PublicPost[];
}

const EMPTY: CompanyExtras = { mission: null, industry: null, sizeBand: null, accent: null, culture: [], perks: [], techStack: [] };

/**
 * A company's public page data. null (so the page 404s) unless the institution is a company AND is public or the viewer belongs to it —
 * the same gate the college page uses. Only roles that are open now are returned; drafts and closed roles never leave the server.
 */
export async function loadPublicCompany(service: SupabaseClient<Database>, slug: string, viewerId: string | null): Promise<PublicCompany | null> {
  const org = await loadPublicOrg(service, slug, viewerId);
  if (!org) return null;
  const db = untyped(service);
  const [typeRes, extrasRes, rolesRes, posts] = await Promise.all([
    service.from("institutions").select("org_type").eq("id", org.institutionId).maybeSingle(),
    db.from("company_profiles").select("mission, industry, size_band, accent, culture, perks, tech_stack").eq("institution_id", org.institutionId).maybeSingle(),
    db
      .from("job_openings")
      .select("id, slug, title, team, location, work_mode, employment_type, summary, about, responsibilities, requirements, nice_to_have, proof_brief, day_to_day, first_months, interview, compensation, status, published_at, closes_on, created_at, updated_at")
      .eq("institution_id", org.institutionId)
      .eq("status", "open")
      .order("published_at", { ascending: false, nullsFirst: false }),
    loadVisiblePosts(service, org, viewerId),
  ]);
  if (typeRes.data?.org_type !== "company") return null;
  const e = extrasRes.data as { mission: string | null; industry: string | null; size_band: string | null; accent: string | null; culture: string[]; perks: string[]; tech_stack: string[] } | null;
  const extras: CompanyExtras = e ? { mission: e.mission, industry: e.industry, sizeBand: e.size_band, accent: e.accent, culture: e.culture ?? [], perks: e.perks ?? [], techStack: e.tech_stack ?? [] } : EMPTY;
  const roles = ((rolesRes.data ?? []) as Parameters<typeof toOpening>[0][]).map(toOpening).filter((o) => isAccepting(o));
  return { org, extras, roles, posts };
}
