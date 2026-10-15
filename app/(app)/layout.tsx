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

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireAuthedUser();

  // The career stage drives the whole app path. Reading it also moves a student whose programme has ended on to graduate.
  const [viewer, { stage, planId }] = await Promise.all([getViewerSummary(supabase, user.id), getStageState(user.id)]);
  // Year and goal prompts are about study years, so only a current student is asked them.
  const direction = stage === "student" ? viewer.direction : null;

  const askYear = direction ? needsYearConfirmation(direction) : false;
  // The trigger depends on end_year, so years are confirmed before the goal prompt is shown.
  const askGoal = direction && !askYear ? shouldShowGoalPrompt(direction) : false;
  const reflection = askGoal ? await getEngagementReflection(createServiceClient(), user.id) : null;

  const assessBanner = await bannerState(createServiceClient() as unknown as Db, user.id);

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

  // A recently graduated user chooses a plan first; nothing else in the app shows until they have.
  const needsPlan = stage === "graduate" && !planId;

  return (
    <AppShell viewer={viewer} stage={stage} banner={needsPlan ? null : banners}>
      {!needsPlan && askGoal && direction && <GoalStatePrompt reflection={reflection} current={direction.goalState} />}
      {needsPlan ? <PlanPicker current={null} /> : children}
    </AppShell>
  );
}
