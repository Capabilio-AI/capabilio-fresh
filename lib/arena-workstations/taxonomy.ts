import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type DomainRoleRow = Database["public"]["Tables"]["arena_domain_roles"]["Row"];
export type SkillAreaRow = Database["public"]["Tables"]["arena_skill_areas"]["Row"];

/**
 * Roles whose key starts with "test-" are disposable fixtures for live tests
 * (docs/job-track-audit.md, Part A). They are invisible everywhere — even when
 * enabled in the database — unless the process sets ALLOW_TEST_ROLES=1, which
 * only a local test run does. Production never serves them.
 */
export const TEST_ROLE_PREFIX = "test-";
const isServable = (roleKey: string) => !roleKey.startsWith(TEST_ROLE_PREFIX) || process.env.ALLOW_TEST_ROLES === "1";

/** Taxonomy is data (arena_domain_roles / arena_skill_areas) — adding an area is a row, not code. */
export async function loadRoleTaxonomy(service: SupabaseClient<Database>, roleKey: string): Promise<{ role: DomainRoleRow; areas: SkillAreaRow[] }> {
  const [{ data: role, error: roleError }, { data: areas, error: areasError }] = await Promise.all([
    service.from("arena_domain_roles").select("*").eq("role_key", roleKey).eq("enabled", true).single(),
    service.from("arena_skill_areas").select("*").eq("role_key", roleKey).order("sort_order"),
  ]);
  if (roleError || !role || !isServable(role.role_key)) throw new Error(`Domain role ${roleKey} not found: ${roleError?.message}`);
  if (areasError) throw areasError;
  return { role, areas: areas ?? [] };
}

export async function listEnabledRoles(service: SupabaseClient<Database>): Promise<DomainRoleRow[]> {
  // Ordered: callers use "first match" / roles[0] fallbacks, which must not depend on physical row order.
  const { data, error } = await service.from("arena_domain_roles").select("*").eq("enabled", true).order("created_at").order("role_key");
  if (error) throw error;
  return (data ?? []).filter((r) => isServable(r.role_key));
}

/** Pure. The first enabled role whose configured keywords appear in the student's stated career. */
export function matchRoleForStatedCareer(roles: DomainRoleRow[], statedRole: string | null): DomainRoleRow | null {
  if (!statedRole) return null;
  const text = statedRole.toLowerCase();
  return roles.find((r) => r.match_keywords.some((k) => text.includes(k.toLowerCase()))) ?? null;
}

/**
 * Pure precedence for a student's active domain role: an explicit choice
 * (membership.active_role_key, set by the Higher Studies Switch) wins, then the
 * role they are already engaged in, then the role matching their stated
 * career, then the first enabled role. Only enabled roles are ever returned.
 */
export function pickActiveRole(
  roles: DomainRoleRow[],
  opts: { activeRoleKey: string | null; engagedRoleKey: string | null; statedRole: string | null }
): DomainRoleRow | null {
  const byKey = (key: string | null) => (key ? roles.find((r) => r.role_key === key) : undefined);
  return byKey(opts.activeRoleKey) ?? byKey(opts.engagedRoleKey) ?? matchRoleForStatedCareer(roles, opts.statedRole) ?? roles[0] ?? null;
}

/**
 * The role a student is currently engaged in: the one whose rotation was advanced most recently.
 * Deterministic on purpose — a student can have rotation rows for several roles, and an unordered
 * "first row" would pick one arbitrarily.
 */
export async function getEngagedRoleKey(service: SupabaseClient<Database>, userId: string): Promise<string | null> {
  const { data } = await service
    .from("arena_rotation_state")
    .select("role_key")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("role_key")
    .limit(1);
  return data?.[0]?.role_key ?? null;
}
