import type { Db } from "./db";
import { ONBOARDING_STATUSES } from "./config";
import { studentGate } from "./gate";

export interface BannerState {
  show: boolean;
  cta: "Start Assessment" | "Continue Assessment";
}

/**
 * Shown to a student on every signed-in page until the status is PROFILE_READY, and not a moment longer. "Continue" when there is
 * anything to continue (an open session, a finished stage, or a confirmed role), so the student resumes instead of restarting.
 */
export async function bannerState(db: Db, userId: string): Promise<BannerState> {
  const gate = await studentGate(db, userId);
  if (!gate.locked || !gate.status) return { show: false, cta: "Start Assessment" };
  const [{ count: open }, { data: intent }] = await Promise.all([
    db.from("assess_sessions").select("id", { count: "exact", head: true }).eq("student_id", userId).eq("status", "IN_PROGRESS"),
    db.from("student_career_intent").select("primary_career_id").eq("student_id", userId).maybeSingle(),
  ]);
  const progressed = (open ?? 0) > 0 || ONBOARDING_STATUSES.indexOf(gate.status) > 0 || !!intent?.primary_career_id;
  return { show: true, cta: progressed ? "Continue Assessment" : "Start Assessment" };
}
