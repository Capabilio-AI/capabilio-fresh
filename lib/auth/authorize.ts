import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type ResourceAction = "read" | "write" | "admin";

const ACTION_RANK: Record<ResourceAction, number> = { read: 1, write: 2, admin: 3 };

/**
 * Real RBAC enforcement: does the caller's role — re-derived from their own
 * institution_memberships row server-side, never a client-supplied claim —
 * grant `action` on `resource`, via the roles/role_permissions tables
 * (docs/platform-evolution/01-database-changes.md, 03-authorization-matrix.md)?
 *
 * `resource = "person"` means "may access ANOTHER person's record" — a
 * caller's own data is never gated by this table; check that separately
 * (`viewerId === targetId`) before calling this for cross-person access.
 *
 * When `organisationId` is given, only memberships in that institution are
 * considered — a role granted in College A never authorizes access scoped
 * to College B.
 */
export async function can(
  supabase: SupabaseClient<Database>,
  userId: string,
  resource: string,
  action: ResourceAction,
  opts?: { organisationId?: string }
): Promise<boolean> {
  let membershipQuery = supabase
    .from("institution_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active");

  if (opts?.organisationId) {
    membershipQuery = membershipQuery.eq("institution_id", opts.organisationId);
  }

  const { data: memberships } = await membershipQuery;
  if (!memberships || memberships.length === 0) return false;

  const roleKeys = [...new Set(memberships.map((m) => m.role))];
  const { data: roleRows } = await supabase.from("roles").select("id").in("key", roleKeys);
  if (!roleRows || roleRows.length === 0) return false;

  const { data: permissionRows } = await supabase
    .from("role_permissions")
    .select("action")
    .in(
      "role_id",
      roleRows.map((r) => r.id)
    )
    .eq("resource", resource);
  if (!permissionRows || permissionRows.length === 0) return false;

  const required = ACTION_RANK[action];
  return permissionRows.some((p) => ACTION_RANK[p.action as ResourceAction] >= required);
}
