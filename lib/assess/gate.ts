import { dashboardUnlocked, getOnboardingStatus, type Db } from "./db";
import type { OnboardingStatus } from "./config";
import { isPostStudy } from "@/lib/stage/stage";

/**
 * Students see only the limited onboarding shell until the career assessment is finished and analysed (PROFILE_READY). Staff,
 * mentors and other roles are never gated, and neither are recently graduated accounts: they see every page from the start
 * (the pages show honest empty states until there is data) and are only nudged, by the banner, to finish their assessment.
 * This is the single place that decides "locked", so the banner, the dashboard and every personalised page agree.
 */
export async function studentGate(db: Db, userId: string): Promise<{ locked: boolean; status: OnboardingStatus | null; graduate: boolean }> {
  const { data: profile } = await db.from("profiles").select("primary_role, student_status").eq("id", userId).maybeSingle();
  if (profile?.primary_role !== "student") return { locked: false, status: null, graduate: false };
  const status = await getOnboardingStatus(db, userId);
  if (isPostStudy(profile.student_status)) return { locked: false, status, graduate: true };
  return { locked: !dashboardUnlocked(status), status, graduate: false };
}
