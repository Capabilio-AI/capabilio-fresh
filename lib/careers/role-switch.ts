import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { PLAN_B_CLOSED_MESSAGE, isPlanBOpen } from "./plan-b";
import { validatePlanB } from "./plan-b-rules";

type Service = SupabaseClient<Database>;
export type SwitchResult = { ok: true } | { ok: false; status: number; message: string };

/** The columns the role switch reads. plan_b_kind and plan_b_decided_at (migration 076) are not in the generated types. */
export interface SwitchRow {
  primary_career_id: string | null;
  secondary_career_id: string | null;
  plan_b_kind: string | null;
  plan_b_decided_at: string | null;
}

/**
 * Pure. A role switch is PENDING from the moment the student confirms the new role until its career assessment is completed: the new role is
 * parked as the second career and the decided time stays empty. Nothing about the main role changes while it is pending.
 */
export const isSwitchPending = (row: SwitchRow | null): boolean => row?.plan_b_kind === "change_role" && !row.plan_b_decided_at && !!row.secondary_career_id;

/**
 * Pure. What to write when a CAREER assessment for `assessedCareerId` is completed: if it is the pending new role, that role becomes the main
 * role and the previous main role is kept as the second career. Anything else (a retake, another role) changes nothing.
 */
export function switchCompletion(row: SwitchRow | null, assessedCareerId: string | null, nowIso: string): { primary_career_id: string; secondary_career_id: string | null; plan_b_decided_at: string; last_updated: string } | null {
  if (!row || !assessedCareerId || !isSwitchPending(row) || row.secondary_career_id !== assessedCareerId) return null;
  return { primary_career_id: assessedCareerId, secondary_career_id: row.primary_career_id, plan_b_decided_at: nowIso, last_updated: nowIso };
}

const SELECT = "primary_career_id, secondary_career_id, plan_b_kind, plan_b_decided_at";
const fail = (status: number, message: string): SwitchResult => ({ ok: false, status, message });

/**
 * The student has seen their Plan A profile and confirmed the new role: park it as the pending switch. The main role is NOT touched; it changes
 * only when the new role's assessment is completed (completeRoleSwitch). A student may restart a pending switch with another role, but a switch
 * that already completed, or any other final Plan B answer, cannot be redone.
 */
export async function startRoleSwitch(service: Service, userId: string, careerId: string): Promise<SwitchResult> {
  if (!(await isPlanBOpen(service, userId))) return fail(403, PLAN_B_CLOSED_MESSAGE);
  const { data } = await untyped(service).from("student_career_intent").select(SELECT).eq("student_id", userId).maybeSingle();
  const row = data as SwitchRow | null;
  const answered = row?.plan_b_kind && row.plan_b_kind !== "undecided" && !isSwitchPending(row);
  if (answered) return fail(409, "You've already chosen your Plan B.");
  const { data: careers } = await service.from("careers").select("id").eq("is_active", true);
  const valid = validatePlanB({ kind: "change_role", careerId }, row?.primary_career_id ?? null, new Set((careers ?? []).map((c) => c.id)));
  if (!valid.ok) return fail(400, valid.message);
  const { error } = await untyped(service).from("student_career_intent").upsert(
    { student_id: userId, plan_b_kind: "change_role", plan_b_decided_at: null, secondary_career_id: careerId, last_updated: new Date().toISOString() },
    { onConflict: "student_id" }
  );
  if (error) {
    console.error("[role-switch] start failed:", error.code, error.message);
    return fail(500, "Something went wrong. Please try again.");
  }
  return { ok: true };
}

/** Called when a career assessment is completed. Makes the new role the main role if (and only if) it is the pending switch. Returns whether it switched. */
export async function completeRoleSwitch(db: Service, userId: string, assessedCareerId: string | null): Promise<boolean> {
  const { data } = await untyped(db).from("student_career_intent").select(SELECT).eq("student_id", userId).maybeSingle();
  const patch = switchCompletion(data as SwitchRow | null, assessedCareerId, new Date().toISOString());
  if (!patch) return false;
  const { error } = await untyped(db).from("student_career_intent").update(patch).eq("student_id", userId);
  if (error) {
    console.error("[role-switch] complete failed:", error.code, error.message);
    return false;
  }
  return true;
}
