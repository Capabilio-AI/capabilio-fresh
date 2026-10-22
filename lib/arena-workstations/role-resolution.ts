import { matchRoleForStatedCareer, type DomainRoleRow } from "./taxonomy";

export type RoleVia = "explicit" | "stated" | "engaged";

/**
 * Pure. Same precedence as `pickActiveRole` (explicit choice, then the role matching the stated career, then the role already engaged) but with
 * NO "first enabled role" fallback: a student whose career has no workstation gets `role: null`, never somebody else's tickets.
 */
export function resolveDomainRole(
  roles: DomainRoleRow[],
  opts: { activeRoleKey: string | null; engagedRoleKey: string | null; statedRole: string | null }
): { role: DomainRoleRow; via: RoleVia } | { role: null; via: null } {
  const byKey = (key: string | null) => (key ? roles.find((r) => r.role_key === key) : undefined);
  const explicit = byKey(opts.activeRoleKey);
  if (explicit) return { role: explicit, via: "explicit" };
  const stated = matchRoleForStatedCareer(roles, opts.statedRole);
  if (stated) return { role: stated, via: "stated" };
  const engaged = byKey(opts.engagedRoleKey);
  if (engaged) return { role: engaged, via: "engaged" };
  return { role: null, via: null };
}
