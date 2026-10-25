import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentDirection } from "@/lib/career/direction";
import { loadDomainSet } from "@/lib/arena-challenges/domain-set";
import { chooseDomainSource } from "@/lib/arena-challenges/domain-source";
import { getEngagedRoleKey, listEnabledRoles } from "./taxonomy";
import { resolveDomainRole } from "./role-resolution";

/** Whether Arena has hands-on tasks for the student's chosen role. "unknown" covers no chosen career and anything we could not read: no claim is made. */
export type RoleTaskAvailability = { state: "ready" } | { state: "building"; careerName: string } | { state: "unknown" };

/**
 * Same resolution as the Domain challenges page (a workstation first, then the fixed catalog), so the Arena home and the Domain page cannot
 * disagree. A role with neither is "building": nothing from another role is substituted, the student is told it is being prepared.
 */
export async function getRoleTaskAvailability(service: SupabaseClient<Database>, userId: string, isStudent: boolean): Promise<RoleTaskAvailability> {
  const view = await loadDomainSet(service, userId, "primary", new Date(), { skipPlanB: !isStudent });
  if (view.state !== "ready") return { state: "unknown" };
  const [roles, direction, engagedRoleKey] = await Promise.all([listEnabledRoles(service), getStudentDirection(service, userId), getEngagedRoleKey(service, userId)]);
  const hasWorkstation = resolveDomainRole(roles, { activeRoleKey: direction?.activeRoleKey ?? null, engagedRoleKey, statedRole: view.career.name }).role !== null;
  const source = chooseDomainSource({ hasWorkstation, catalogItems: view.items.length, catalogCountdown: Boolean(view.unlockAt) });
  return source === "none" ? { state: "building", careerName: view.career.name } : { state: "ready" };
}
