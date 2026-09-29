import type { ReactNode } from "react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { getStudentDirection, needsYearConfirmation } from "@/lib/career/direction";
import { AppShell } from "@/components/shell/AppShell";
import { YearConfirmCard } from "@/components/direction/YearConfirmCard";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireAuthedUser();

  const [viewer, direction] = await Promise.all([
    getViewerSummary(supabase, user.id),
    getStudentDirection(supabase, user.id),
  ]);

  const banner =
    direction && needsYearConfirmation(direction) ? (
      <YearConfirmCard
        startYear={direction.startYear}
        endYear={direction.endYear}
        computedYear={direction.academicYear?.year ?? null}
        overrideYear={direction.academicYear?.source === "override" ? direction.academicYear.year : null}
      />
    ) : null;

  return (
    <AppShell viewer={viewer} banner={banner}>
      {children}
    </AppShell>
  );
}
