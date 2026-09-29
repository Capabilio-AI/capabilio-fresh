import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentDirection, type GoalState } from "./direction";
import { validateProgramYears } from "./years";

export type WriteResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * Student-declared program years (validated) and the manual current-year
 * override. Always resolves the membership from the authenticated user id, so
 * a caller can only ever change their own row. `service` bypasses RLS on
 * purpose: institution_memberships has no UPDATE policy for clients.
 */
export async function saveProgramYears(
  service: SupabaseClient<Database>,
  userId: string,
  input: { startYear: number; endYear: number; currentYearOverride: number | null },
  now: Date = new Date()
): Promise<WriteResult> {
  const years = validateProgramYears(input.startYear, input.endYear, now);
  if (!years.ok) return { ok: false, status: 400, message: years.message };
  const direction = await getStudentDirection(service, userId, now);
  if (!direction) return { ok: false, status: 404, message: "No student program found for your account." };
  const { error } = await service
    .from("institution_memberships")
    .update({
      start_year: years.startYear,
      end_year: years.endYear,
      year_override: input.currentYearOverride,
      year_confirmed_at: now.toISOString(),
    })
    .eq("id", direction.membershipId)
    .eq("user_id", userId);
  if (error) return { ok: false, status: 500, message: "Could not save — try again." };
  return { ok: true };
}

async function ownMembershipId(service: SupabaseClient<Database>, userId: string, now: Date) {
  return (await getStudentDirection(service, userId, now))?.membershipId ?? null;
}

async function updateOwn(
  service: SupabaseClient<Database>,
  userId: string,
  patch: Database["public"]["Tables"]["institution_memberships"]["Update"],
  now: Date
): Promise<WriteResult> {
  const membershipId = await ownMembershipId(service, userId, now);
  if (!membershipId) return { ok: false, status: 404, message: "No student program found for your account." };
  const { error } = await service.from("institution_memberships").update(patch).eq("id", membershipId).eq("user_id", userId);
  if (error) return { ok: false, status: 500, message: "Could not save — try again." };
  return { ok: true };
}

/** Any of the four states, any time — no lock-in. Choosing one also counts as having been prompted / checked in. */
export function saveGoalState(service: SupabaseClient<Database>, userId: string, goalState: GoalState, now: Date = new Date()) {
  const stamp = now.toISOString();
  return updateOwn(
    service,
    userId,
    {
      goal_state: goalState,
      goal_state_updated_at: stamp,
      goal_state_prompted_at: stamp,
      higher_studies_checkin_at: goalState === "higher_studies" ? stamp : null,
    },
    now
  );
}

/** "Decide later" / "Continue": restarts the resurfacing clock without changing the goal. */
export function recordPromptSeen(service: SupabaseClient<Database>, userId: string, prompt: "goal" | "checkin", now: Date = new Date()) {
  const stamp = now.toISOString();
  return updateOwn(service, userId, prompt === "goal" ? { goal_state_prompted_at: stamp } : { higher_studies_checkin_at: stamp }, now);
}
