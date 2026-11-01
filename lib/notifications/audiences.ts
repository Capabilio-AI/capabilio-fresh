import { onlyCurrentStudents } from "@/lib/org/current-students";
import { getStudentDirection } from "@/lib/career/direction";
import { branchMatchesAny } from "@/lib/org/branch-scope";
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
  const { data } = await onlyCurrentStudents(untyped(service).from("institution_memberships").select("user_id, branch").eq("institution_id", institutionId).eq("role", "student").eq("status", "active")).limit(5000);
  const rows = (data ?? []) as { user_id: string; branch: string | null }[];
  const open = !branches || branches.length === 0;
  return rows.filter((m) => open || branchMatchesAny(branches, m.branch)).map((m) => m.user_id);
}

/**
 * Students who can register for a company visit right now: active, of an eligible branch, in the year Launchpad opens for them (the same
 * rule the apply route enforces), and not in `exclude` (usually those who already registered). Checked a few at a time so a large college
 * does not open hundreds of connections at once.
 */
export async function studentsWhoCanRegister(service: SupabaseClient<Database>, institutionId: string, branches: readonly string[] | null | undefined, exclude: ReadonlySet<string> = new Set()): Promise<string[]> {
  const candidates = (await activeStudents(service, institutionId, branches)).filter((id) => !exclude.has(id));
  const open: string[] = [];
  const BATCH = 10;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const checked = await Promise.all(candidates.slice(i, i + BATCH).map(async (id) => ((await getStudentDirection(service, id))?.launchpadOpen ? id : null)));
    open.push(...checked.filter((id): id is string => id !== null));
  }
  return open;
}
