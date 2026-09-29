import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { can } from "@/lib/auth/authorize";
import { requireUser } from "@/lib/api/require-user";
import { effectivePermissions } from "@/lib/org/roles";
import { untyped } from "@/lib/org/db";

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
  // untyped: `permissions` postdates the generated types
  const { data } = await untyped(supabase)
    .from("institution_memberships")
    .select("institution_id, role, permissions, institutions ( name )")
    .eq("user_id", userId)
    .eq("status", "active")
    .neq("role", "student");
  for (const m of (data ?? []) as unknown as { institution_id: string; role: string; permissions: string[] | null; institutions: { name: string } | null }[]) {
    const name = m.institutions?.name ?? "Your institution";
    // a member the admin granted the Curriculum permission, or a role the RBAC table lets administer the organisation
    if (effectivePermissions(m.role, m.permissions).has("curriculum") || (await can(supabase, userId, "organisation", "admin", { organisationId: m.institution_id }))) {
      return { userId, institutionId: m.institution_id, institutionName: name };
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
