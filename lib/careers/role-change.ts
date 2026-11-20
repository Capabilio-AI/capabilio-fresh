import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped, type Db } from "@/lib/org/db";
import { studentGate } from "@/lib/assess/gate";
import { canSkipRole } from "@/lib/assess/skip";
import { saveCareerIntent, type Result } from "./intent";
import { ROLE_CHANGE_LIMIT, ROLE_LIMIT_MESSAGE, ROLE_LOCKED_MESSAGE, roleChangesLeft, type RoleChangeReason } from "./role-change-rules";

type Service = SupabaseClient<Database>;
const fail = (status: number, message: string): { ok: false; status: number; message: string } => ({ ok: false, status, message });

/** How many of the student's role changes are used, or null when it cannot be read (the table of migration 207 is missing): the caller then offers no change. */
export async function roleChangesUsed(service: Service, userId: string): Promise<number | null> {
  // a plain select, not a HEAD count: a HEAD request on a missing table reports no error, and the student would see 3 changes left that cannot be made
  const { data, error } = await untyped(service).from("career_role_changes").select("id").eq("student_id", userId);
  return error || !data ? null : data.length;
}

/**
 * The state a student sees before changing: the changes left, or null when changes are not available yet. Always about the caller.
 */
export async function roleChangeState(service: Service, userId: string): Promise<{ used: number; left: number; limit: number } | null> {
  const used = await roleChangesUsed(service, userId);
  return used === null ? null : { used, left: roleChangesLeft(used), limit: ROLE_CHANGE_LIMIT };
}

/**
 * Once the student's dashboard is open, the main role can be replaced only through changePrimaryRole (3 times, with a reason). While they are still
 * onboarding it stays free to fix a wrongly entered role. Returns the message to refuse with, or null when the save may go ahead.
 */
export async function roleReplaceBlocked(service: Service, userId: string, nextPrimaryId: string): Promise<string | null> {
  const { data } = await service.from("student_career_intent").select("primary_career_id").eq("student_id", userId).maybeSingle();
  if (!data?.primary_career_id || data.primary_career_id === nextPrimaryId) return null;
  const gate = await studentGate(service as unknown as Db, userId);
  return gate.locked ? null : ROLE_LOCKED_MESSAGE;
}

/**
 * The student's change of main role from the dashboard. The change is recorded first, and the database refuses a 4th under a lock, so two
 * requests at once cannot both pass; if the role then fails to save, the record is removed and no change is used. Plan B is not touched
 * and is not counted. `assessNow` is false for a 1st or 2nd year, whose role assessment comes with the 3rd-year Plan B question.
 */
export async function changePrimaryRole(
  service: Service,
  userId: string,
  body: { careerId: string; reason: RoleChangeReason; details?: string }
): Promise<Result<{ left: number; assessNow: boolean }>> {
  const used = await roleChangesUsed(service, userId);
  if (used === null) return fail(503, "Changing your role isn't available right now. Please try again later.");
  if (roleChangesLeft(used) === 0) return fail(403, ROLE_LIMIT_MESSAGE);

  const gate = await studentGate(service as unknown as Db, userId);
  if (gate.locked || gate.graduate) return fail(403, "Finish your assessment first. You can change your role from your dashboard after that.");

  const { data: intent } = await service.from("student_career_intent").select("primary_career_id, secondary_career_id").eq("student_id", userId).maybeSingle();
  if (!intent?.primary_career_id) return fail(409, "Choose your first role before changing it.");
  if (intent.primary_career_id === body.careerId) return fail(400, "That is already your role.");
  if (intent.secondary_career_id === body.careerId) return fail(400, "That is your Plan B role. Pick a different one.");
  const { data: career } = await service.from("careers").select("id").eq("id", body.careerId).eq("is_active", true).maybeSingle();
  if (!career) return fail(400, "That role isn't available.");

  const { data: logged, error } = await untyped(service)
    .from("career_role_changes")
    .insert({ student_id: userId, from_career_id: intent.primary_career_id, to_career_id: body.careerId, reason: body.reason, details: body.details?.trim() || null })
    .select("id")
    .single();
  if (error || !logged) {
    if (error?.message.includes("role_change_limit")) return fail(403, ROLE_LIMIT_MESSAGE);
    console.error("[role-change] log failed:", error?.code, error?.message);
    return fail(500, "Something went wrong. Please try again.");
  }

  const saved = await saveCareerIntent(service, userId, { primaryCareerId: body.careerId, isExploring: false });
  if (!saved.ok) {
    await untyped(service).from("career_role_changes").delete().eq("id", logged.id);
    return saved;
  }
  return { ok: true, left: roleChangesLeft(used + 1), assessNow: !(await canSkipRole(service, userId)) };
}
