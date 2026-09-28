import type { Metadata } from "next";
import { Award, CalendarClock, GraduationCap } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getEducationEntries, getEducationTimeline } from "@/lib/dashboard/education";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { EducationHistoryList } from "@/components/education/EducationHistoryList";

export const metadata: Metadata = { title: "Educational History — Capabilio AI" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function EducationHistoryPage() {
  const { supabase, user } = await requireAuthedUser();

  const [entries, timeline] = await Promise.all([
    getEducationEntries(supabase, user.id),
    getEducationTimeline(supabase, user.id),
  ]);

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Educational History</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Your institutions and academic timeline — nothing else.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>

      <div className="flex flex-col gap-5 pt-6">
        <EducationHistoryList entries={entries} />

        <div className="rounded-xl border border-app-border bg-white p-5">
          <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-blue">
            <CalendarClock size={14} />
            Timeline
          </div>
          {timeline.length === 0 ? (
            <p className="mt-4 font-lp-body text-[13px] text-app-muted">Nothing recorded yet.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {timeline.map((m, i) => {
                const Icon = m.kind === "certificate" ? Award : GraduationCap;
                return (
                  <div key={`${m.label}-${i}`} className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-app-background text-app-charcoal">
                      <Icon size={13} />
                    </span>
                    <div>
                      <p className="font-lp-body text-[13px] font-medium text-app-charcoal">{m.label}</p>
                      <p className="font-lp-mono text-[11px] text-app-muted">{formatDate(m.date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
