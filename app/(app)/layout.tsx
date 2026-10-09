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

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireAuthedUser();

  const viewer = await getViewerSummary(supabase, user.id);
  const direction = viewer.direction;

  const askYear = direction ? needsYearConfirmation(direction) : false;
  // The trigger depends on end_year, so years are confirmed before the goal prompt is shown.
  const askGoal = direction && !askYear ? shouldShowGoalPrompt(direction) : false;
  const reflection = askGoal ? await getEngagementReflection(createServiceClient(), user.id) : null;

  const assessBanner = await bannerState(createServiceClient() as unknown as Db, user.id);

  const banner =
    direction && askYear ? (
      <YearConfirmCard
        startYear={direction.startYear}
        endYear={direction.endYear}
        computedYear={direction.academicYear?.year ?? null}
        overrideYear={direction.academicYear?.source === "override" ? direction.academicYear.year : null}
      />
    ) : null;
  const banners = (
    <>
      {assessBanner.show && <AssessmentBanner cta={assessBanner.cta} />}
      {banner}
    </>
  );

  return (
    <AppShell viewer={viewer} banner={banners}>
      {askGoal && direction && <GoalStatePrompt reflection={reflection} current={direction.goalState} />}
      {children}
    </AppShell>
  );
}
