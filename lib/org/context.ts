import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "./db";
import { effectivePermissions, kindOf, type OrgKind, type OrgPermissionKey } from "./roles";

export interface OrgContext {
  userId: string;
  membershipId: string;
  institutionId: string;
  institutionName: string;
  institutionSlug: string;
  role: string;
  kind: OrgKind;
  branch: string | null;
  /** What this member may do: the role default, or the custom set an admin granted (admins: everything). */
  permissions: ReadonlySet<OrgPermissionKey>;
}

/**
 * The caller's org context, derived ONLY from their own ACTIVE membership (read as the user, under RLS) —
 * never from a request field. A pending or rejected member has no context at all.
 */
export async function getOrgContext(supabase: SupabaseClient<Database>, userId: string): Promise<OrgContext | null> {
  // untyped: `permissions` postdates the generated types
  const { data } = await untyped(supabase)
    .from("institution_memberships")
    .select("id, institution_id, role, branch, permissions, institutions ( name, slug )")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  type Row = { id: string; institution_id: string; role: string; branch: string | null; permissions: string[] | null; institutions: { name: string; slug: string } | null };
  for (const m of (data ?? []) as unknown as Row[]) {
    const kind = kindOf(m.role);
    const inst = m.institutions;
    if (kind && inst) {
      return {
        userId,
        membershipId: m.id,
        institutionId: m.institution_id,
        institutionName: inst.name,
        institutionSlug: inst.slug,
        role: m.role,
        kind,
        branch: m.branch,
        permissions: effectivePermissions(m.role, m.permissions),
      };
    }
  }
  return null;
}
