import type { ReactNode } from "react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { needsYearConfirmation, shouldShowGoalPrompt } from "@/lib/career/direction";
import { getEngagementReflection } from "@/lib/career/reflection";
import { createServiceClient } from "@/lib/supabase/service";
import { AppShell } from "@/components/shell/AppShell";
import { AssessmentBanner } from "@/components/assess/AssessmentBanner";
import { bannerState } from "@/lib/assess/banner";
import type { Db } from "@/lib/assess/db";
import { YearConfirmCard } from "@/components/direction/YearConfirmCard";
import { GoalStatePrompt } from "@/components/direction/GoalStatePrompt";
import { getStageState } from "@/lib/stage/server";
import { PlanPicker } from "@/components/plans/PlanPicker";
import { unreadAlerts } from "@/lib/professional/notifications";
import { studentHasRole } from "@/lib/careers/has-role";
import { isPlatformAdmin } from "@/lib/arena-content/store";
import { getStudentDirection } from "@/lib/career/direction";
import { ensureStudentMembership } from "@/lib/org/ensure-membership";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireAuthedUser();

  // The career stage drives the whole app path. Reading it also moves a student whose programme has ended on to graduate.
  const service = createServiceClient();
  const [stageState, assessBanner, hasRole] = await Promise.all([
    getStageState(user.id),
    bannerState(service as unknown as Db, user.id),
    studentHasRole(service, user.id),
  ]);
  const { stage, planId } = stageState;
  // Details given at sign-up are restored before the viewer is read, so the college and stream are never asked for again.
  if (stage === "student") await ensureStudentMembership(service, user.id).catch(() => false);
  const viewer = await getViewerSummary(supabase, user.id);
  // The year that decides what is open is read the way the page guards read it (service client), so a nav item is never shown that its page then refuses.
  const isAdmin = await isPlatformAdmin(service, user.id).catch(() => false);
  const year = stage === "student" ? ((await getStudentDirection(service, user.id))?.academicYear?.year ?? null) : null;
  // Year and goal prompts are about study years, so only a current student is asked them.
  const direction = stage === "student" ? viewer.direction : null;

  const askYear = direction ? needsYearConfirmation(direction) : false;
  // The trigger depends on end_year, so years are confirmed before the goal prompt is shown.
  const askGoal = direction && !askYear ? shouldShowGoalPrompt(direction) : false;
  const reflection = askGoal ? await getEngagementReflection(createServiceClient(), user.id) : null;

  const banner =
    direction && askYear ? (
      <YearConfirmCard />
    ) : null;
  const banners = (
    <>
      {assessBanner.show && <AssessmentBanner cta={assessBanner.cta} />}
      {banner}
    </>
  );

  // A professional's unread alerts, for the bell. Zero for everyone else.
  const alerts = stage === "professional" ? await unreadAlerts(user.id) : 0;

  // A recently graduated user chooses a plan first; nothing else in the app shows until they have.
  const needsPlan = stage === "graduate" && !planId;

  return (
    <AppShell viewer={viewer} stage={stage} alerts={alerts} hasRole={stage !== "student" || hasRole} year={year} isAdmin={isAdmin} banner={needsPlan ? null : banners}>
      {!needsPlan && askGoal && direction && <GoalStatePrompt reflection={reflection} current={direction.goalState} />}
      {needsPlan ? <PlanPicker current={null} /> : children}
    </AppShell>
  );
}
