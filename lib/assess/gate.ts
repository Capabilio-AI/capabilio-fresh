import { dashboardUnlocked, getOnboardingStatus, type Db } from "./db";
import type { OnboardingStatus } from "./config";

/**
 * Students see only the limited onboarding shell until the career assessment is finished and analysed (PROFILE_READY). Staff,
 * mentors and other roles are never gated. This is the single place that decides "locked", so the banner, the dashboard and
 * every personalised page agree.
 */
export async function studentGate(db: Db, userId: string): Promise<{ locked: boolean; status: OnboardingStatus | null }> {
  const { data: profile } = await db.from("profiles").select("primary_role").eq("id", userId).maybeSingle();
  if (profile?.primary_role !== "student") return { locked: false, status: null };
  const status = await getOnboardingStatus(db, userId);
  return { locked: !dashboardUnlocked(status), status };
}
