import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getEducationHistory, getEducationTimeline } from "@/lib/dashboard/education";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { EducationInstitutionCard } from "@/components/education/EducationInstitutionCard";
import { CertificateUpload } from "@/components/education/CertificateUpload";

export const metadata: Metadata = { title: "Educational History — Capabilio AI" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function EducationHistoryPage() {
  const { supabase, user } = await requireAuthedUser();

  const [history, timeline] = await Promise.all([
    getEducationHistory(supabase, user.id),
    getEducationTimeline(supabase, user.id),
  ]);

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Educational History</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Your institution and academic timeline — nothing else.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>

      <div className="flex flex-col gap-5 pt-6">
        <EducationInstitutionCard
          institutionName={history.institutionName}
          collegeType={history.collegeType}
          city={history.city}
          state={history.state}
          branch={history.branch}
          year={history.year}
        />

        <div className="rounded-xl border border-app-border bg-white p-5">
          <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-blue">
            <CalendarClock size={14} />
            Timeline
          </div>
          {timeline.length === 0 ? (
            <p className="mt-4 font-lp-body text-[13px] text-app-muted">Nothing recorded yet.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {timeline.map((m, i) => (
                <div key={`${m.label}-${i}`} className="flex gap-3 border-l-2 border-app-border pl-3">
                  <div>
                    <p className="font-lp-body text-[13px] font-medium text-app-charcoal">{m.label}</p>
                    <p className="font-lp-mono text-[11px] text-app-muted">{formatDate(m.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <CertificateUpload />
      </div>
    </div>
  );
}
