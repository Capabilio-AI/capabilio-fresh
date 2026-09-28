import type { Metadata } from "next";
import { Building2, CalendarClock, GraduationCap, Layers, MapPin } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getEducationHistory } from "@/lib/dashboard/education";
import { getDashboardData } from "@/lib/dashboard/data";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { TIER_BAR, TIER_CONTAINER, TIER_LABEL, scoreTier } from "@/components/dashboard/tier";

export const metadata: Metadata = { title: "Educational History — Capabilio AI" };

const COLLEGE_TYPE_LABEL: Record<string, string> = {
  engineering: "Engineering",
  medical: "Medical",
  management: "Management",
  arts_science: "Arts & Science",
  pharmacy: "Pharmacy",
  law: "Law",
  other: "Other",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatYearSemester(year: string | null): string | null {
  if (!year) return null;
  const [y, s] = year.split("-");
  const ordinal: Record<string, string> = { "1": "1st", "2": "2nd", "3": "3rd", "4": "4th" };
  return `${ordinal[y] ?? y} Year, Semester ${s}`;
}

export default async function EducationHistoryPage() {
  const { supabase, user } = await requireAuthedUser();

  const [history, assessmentSectionScores] = await Promise.all([
    getEducationHistory(supabase, user.id),
    // Reuses the real assessment section scores already computed for the
    // Overview tab — this page just curates the two sections that map
    // most directly to formal engineering-curriculum subjects, rather than
    // repeating all six (already shown on Overview/Skill Gap).
    getDashboardData(supabase, user.id)
      .then((d) => d.sectionScores)
      .catch(() => []),
  ]);

  const academicFoundation = assessmentSectionScores.filter((s) =>
    ["engineering_mathematics", "basic_sciences"].includes(s.section)
  );

  const milestones = [
    { label: "Enrolled", date: history.memberSince },
    { label: "Diagnostic assessment completed", date: history.assessmentCompletedAt },
    { label: "Guide path generated", date: history.guidePathGeneratedAt },
  ].filter((m): m is { label: string; date: string } => Boolean(m.date));

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Educational History</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Your institution, program, and academic timeline on Capabilio.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>

      <div className="flex flex-col gap-5 pt-6">
        <div className="rounded-xl border border-app-border bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-app-background text-app-charcoal">
              <Building2 size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="font-lp-display text-[16px] font-semibold text-app-charcoal">
                {history.institutionName ?? "No institution on record"}
              </h2>
              {(history.city || history.state) && (
                <p className="mt-0.5 flex items-center gap-1 font-lp-mono text-[11px] text-app-muted">
                  <MapPin size={11} />
                  {[history.city, history.state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">College type</p>
              <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">
                {history.collegeType ? (COLLEGE_TYPE_LABEL[history.collegeType] ?? history.collegeType) : "—"}
              </p>
            </div>
            <div>
              <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">Branch</p>
              <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">{history.branch ?? "—"}</p>
            </div>
            <div>
              <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">Year</p>
              <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">
                {formatYearSemester(history.year) ?? "—"}
              </p>
            </div>
            <div>
              <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">Program</p>
              <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">
                {history.programName ?? history.departmentName ?? history.cohortName ?? "Not yet assigned"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-app-border bg-white p-5">
            <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-blue">
              <CalendarClock size={14} />
              Timeline
            </div>
            {milestones.length === 0 ? (
              <p className="mt-4 font-lp-body text-[13px] text-app-muted">Nothing recorded yet.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {milestones.map((m) => (
                  <div key={m.label} className="flex gap-3 border-l-2 border-app-border pl-3">
                    <div>
                      <p className="font-lp-body text-[13px] font-medium text-app-charcoal">{m.label}</p>
                      <p className="font-lp-mono text-[11px] text-app-muted">{formatDate(m.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-app-border bg-white p-5">
            <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-orange">
              <GraduationCap size={14} />
              Academic foundation
            </div>
            <p className="mt-1 font-lp-body text-[12px] text-app-muted">
              Your diagnostic results on the two sections tied most directly to formal engineering coursework.
            </p>
            {academicFoundation.length === 0 ? (
              <p className="mt-4 font-lp-body text-[13px] text-app-muted">Complete your assessment to see this.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {academicFoundation.map((s) => {
                  const tier = scoreTier(s.percentage);
                  return (
                    <div key={s.section}>
                      <div className="flex items-center justify-between">
                        <span className="font-lp-body text-[13px] text-app-charcoal">{s.label}</span>
                        <span className={`rounded-full px-2 py-0.5 font-lp-mono text-[10.5px] font-semibold ${TIER_CONTAINER[tier]}`}>
                          {TIER_LABEL[tier]}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-app-background">
                        <div className={`h-full rounded-full ${TIER_BAR[tier]}`} style={{ width: `${s.percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-dashed border-app-border bg-white px-4 py-3 font-lp-body text-[12px] text-app-muted">
          <Layers size={14} className="text-app-muted shrink-0" />
          Program/department/cohort assignment is set by your institution admin — once assigned, it appears here
          automatically.
        </div>
      </div>
    </div>
  );
}
