import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface EngagementReflection {
  roleKey: string;
  roleLabel: string;
  verifiedCount: number;
}

/** Pure: the role with the most verified Arena attempts; null when there are none (nothing is inferred). */
export function pickTopRole(rows: { role_key: string; verified_count: number }[]): { roleKey: string; verifiedCount: number } | null {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.role_key, (totals.get(r.role_key) ?? 0) + r.verified_count);
  let best: { roleKey: string; verifiedCount: number } | null = null;
  for (const [roleKey, verifiedCount] of totals) {
    if (verifiedCount > 0 && (best === null || verifiedCount > best.verifiedCount)) best = { roleKey, verifiedCount };
  }
  return best;
}

/**
 * Real engagement only: verified attempt counts per role (time spent is not
 * recorded, so it is never claimed). Null → the plain fallback prompt.
 */
export async function getEngagementReflection(
  service: SupabaseClient<Database>,
  userId: string
): Promise<EngagementReflection | null> {
  const { data: ratings } = await service.from("arena_skill_ratings").select("role_key, verified_count").eq("user_id", userId);
  const top = pickTopRole(ratings ?? []);
  if (!top) return null;
  const { data: role } = await service.from("arena_domain_roles").select("display_name").eq("role_key", top.roleKey).maybeSingle();
  if (!role) return null;
  return { roleKey: top.roleKey, roleLabel: role.display_name, verifiedCount: top.verifiedCount };
}
