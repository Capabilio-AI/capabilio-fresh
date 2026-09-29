import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { can } from "@/lib/auth/authorize";
import { requireUser } from "@/lib/api/require-user";

export interface OrgAdmin {
  userId: string;
  institutionId: string;
  institutionName: string;
}

/**
 * The caller's institution, but only if the existing RBAC (`can`) grants them `organisation:admin`
 * there through an ACTIVE membership. The institution is always derived from the caller's own
 * memberships — never from a request — so an admin can only ever touch their own institution.
 */
export async function getOrgAdmin(supabase: SupabaseClient<Database>, userId: string): Promise<OrgAdmin | null> {
  const { data } = await supabase
    .from("institution_memberships")
    .select("institution_id, institutions ( name )")
    .eq("user_id", userId)
    .eq("status", "active")
    .neq("role", "student");
  for (const m of data ?? []) {
    if (await can(supabase, userId, "organisation", "admin", { organisationId: m.institution_id })) {
      return { userId, institutionId: m.institution_id, institutionName: (m.institutions as { name: string } | null)?.name ?? "Your institution" };
    }
  }
  return null;
}

export async function requireOrgAdmin(supabase: SupabaseClient<Database>): Promise<OrgAdmin | { error: NextResponse }> {
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth;
  const admin = await getOrgAdmin(supabase, auth.userId);
  if (!admin) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return admin;
}
