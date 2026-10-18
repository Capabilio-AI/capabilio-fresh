import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { effectivePermissions, kindOf, type OrgPermissionKey } from "@/lib/org/roles";

/** Active staff of a college whose role (or custom access) includes `permission`. Admins hold every permission. */
export async function staffWithPermission(service: SupabaseClient<Database>, institutionId: string, permission: OrgPermissionKey): Promise<string[]> {
  const { data } = await untyped(service).from("institution_memberships").select("user_id, role, permissions").eq("institution_id", institutionId).eq("status", "active").neq("role", "student").limit(500);
  return ((data ?? []) as { user_id: string; role: string; permissions: string[] | null }[])
    .filter((m) => kindOf(m.role) !== null && effectivePermissions(m.role, m.permissions).has(permission))
    .map((m) => m.user_id);
}

/** Active students of a college, optionally limited to some branches (null/empty = everyone). */
export async function activeStudents(service: SupabaseClient<Database>, institutionId: string, branches?: readonly string[] | null): Promise<string[]> {
  let q = untyped(service).from("institution_memberships").select("user_id").eq("institution_id", institutionId).eq("role", "student").eq("status", "active").limit(5000);
  if (branches && branches.length > 0) q = q.in("branch", [...branches]);
  const { data } = await q;
  return ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
}
