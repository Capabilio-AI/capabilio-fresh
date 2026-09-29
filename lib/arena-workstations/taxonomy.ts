import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type DomainRoleRow = Database["public"]["Tables"]["arena_domain_roles"]["Row"];
export type SkillAreaRow = Database["public"]["Tables"]["arena_skill_areas"]["Row"];

/** Taxonomy is data (arena_domain_roles / arena_skill_areas) — adding an area is a row, not code. */
export async function loadRoleTaxonomy(service: SupabaseClient<Database>, roleKey: string): Promise<{ role: DomainRoleRow; areas: SkillAreaRow[] }> {
  const [{ data: role, error: roleError }, { data: areas, error: areasError }] = await Promise.all([
    service.from("arena_domain_roles").select("*").eq("role_key", roleKey).eq("enabled", true).single(),
    service.from("arena_skill_areas").select("*").eq("role_key", roleKey).order("sort_order"),
  ]);
  if (roleError || !role) throw new Error(`Domain role ${roleKey} not found: ${roleError?.message}`);
  if (areasError) throw areasError;
  return { role, areas: areas ?? [] };
}

export async function listEnabledRoles(service: SupabaseClient<Database>): Promise<DomainRoleRow[]> {
  const { data, error } = await service.from("arena_domain_roles").select("*").eq("enabled", true);
  if (error) throw error;
  return data ?? [];
}

/** Pure. The first enabled role whose configured keywords appear in the student's stated career. */
export function matchRoleForStatedCareer(roles: DomainRoleRow[], statedRole: string | null): DomainRoleRow | null {
  if (!statedRole) return null;
  const text = statedRole.toLowerCase();
  return roles.find((r) => r.match_keywords.some((k) => text.includes(k.toLowerCase()))) ?? null;
}
