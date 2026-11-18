import { dashboardUnlocked, getOnboardingStatus, type Db } from "./db";
import type { OnboardingStatus } from "./config";
import { isPostStudy, toStage } from "@/lib/stage/stage";
import { canSkipRole } from "./skip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Students see only the limited onboarding shell until the career assessment is finished and analysed (PROFILE_READY). Staff,
 * mentors and other roles are never gated, and neither are recently graduated or professional accounts: they see every page from the start
 * (the pages show honest empty states until there is data) and are only nudged, by the banner, to finish their assessment.
 * This is the single place that decides "locked", so the banner, the dashboard and every personalised page agree.
 */
export async function studentGate(db: Db, userId: string): Promise<{ locked: boolean; status: OnboardingStatus | null; graduate: boolean; professional: boolean }> {
  const { data: profile } = await db.from("profiles").select("primary_role, student_status").eq("id", userId).maybeSingle();
  if (profile?.primary_role !== "student") return { locked: false, status: null, graduate: false, professional: false };
  const status = await getOnboardingStatus(db, userId);
  if (isPostStudy(profile.student_status)) return { locked: false, status, graduate: true, professional: toStage(profile.student_status) === "professional" };
  if (dashboardUnlocked(status)) return { locked: false, status, graduate: false, professional: false };
  return { locked: !(await skippedRoleDone(db, userId, status)), status, graduate: false, professional: false };
}

/**
 * A 1st or 2nd year who finished the common assessment has nothing more to unlock: the app opens for them, with a role chosen or still being explored.
 * The role assessment is optional for them until the 3rd-year Plan B question.
 */
async function skippedRoleDone(db: Db, userId: string, status: OnboardingStatus): Promise<boolean> {
  if (status !== "COMMON_ASSESSMENT_COMPLETE") return false;
  const { data: intent } = await db.from("student_career_intent").select("primary_career_id, is_exploring").eq("student_id", userId).maybeSingle();
  if (!intent?.is_exploring && !intent?.primary_career_id) return false;
  return canSkipRole(db as unknown as SupabaseClient<Database>, userId);
}
