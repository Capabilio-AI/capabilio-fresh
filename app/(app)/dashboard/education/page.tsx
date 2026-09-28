import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getEducationEntries } from "@/lib/dashboard/education";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { EducationHistoryList } from "@/components/education/EducationHistoryList";

export const metadata: Metadata = { title: "Educational History — Capabilio AI" };

export default async function EducationHistoryPage() {
  const { supabase, user } = await requireAuthedUser();

  const entries = await getEducationEntries(supabase, user.id);

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Educational History</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your institutions, most recent first.</p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>

      <div className="flex flex-col gap-5 pt-6">
        <EducationHistoryList entries={entries} />
      </div>
    </div>
  );
}
