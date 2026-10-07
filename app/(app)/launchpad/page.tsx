import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Calendar, Lock, MapPin, Rocket } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { matchCareersForStudent } from "@/lib/career/match";
import { listOpenOpportunities, type OpportunityType } from "@/lib/launchpad/opportunities";
import { StudentPlacementOffers } from "@/components/org/StudentPlacementOffers";
import { ActionButton } from "@/components/org/ActionButton";
import { REGISTRATION_LABEL } from "@/lib/org/visits";

export const metadata: Metadata = { title: "Launchpad — Capabilio AI" };

const TYPE_LABEL: Record<OpportunityType, string> = { job: "Job", internship: "Internship", competition: "Competition", referral: "Referral" };
const TYPE_COLOR: Record<OpportunityType, string> = {
  job: "bg-app-success-container text-app-success",
  internship: "bg-app-blue-container text-app-blue",
  competition: "bg-app-warning-container text-app-warning",
  referral: "bg-app-orange-container text-app-orange",
};

export default async function LaunchpadPage() {
  const { supabase, user } = await requireAuthedUser();

  const [viewer, careerMatches] = await Promise.all([
    getViewerSummary(supabase, user.id),
    matchCareersForStudent(supabase, user.id),
  ]);

  const direction = viewer.direction;
  const unlocked = direction?.launchpadOpen ?? false;

  if (!unlocked) {
    return (
      <div>
        <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Launchpad</h1>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">Jobs, internships, competitions, and referrals.</p>
        <StudentPlacementOffers userId={user.id} />

        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-app-border bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app-attention-container text-app-attention">
            <Lock size={20} />
          </span>
          <h2 className="font-lp-display text-[18px] font-semibold text-app-charcoal">Not open yet</h2>
          <p className="max-w-md font-lp-body text-[13.5px] text-app-muted">
            Launchpad opens when you enter your final year (4-1).
          </p>
        </div>
      </div>
    );
  }

  const opportunities = await listOpenOpportunities(supabase);
  // own rows only (RLS); status is written by the college, never by the student
  const { data: myApps } = await supabase.from("applications").select("opportunity_id, status").eq("user_id", user.id);
  const appliedStatus = new Map((myApps ?? []).map((a) => [a.opportunity_id, a.status]));
  const APPLIED_LABEL = REGISTRATION_LABEL;
  const gapSkills = new Set((careerMatches[0]?.skillGaps ?? []).map((g) => g.skill));

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Launchpad</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Jobs, internships, competitions, and referrals.</p>
      <StudentPlacementOffers userId={user.id} />

      {direction && direction.track !== "job" && (
        <p className="mt-4 rounded-lg border border-app-border bg-white px-4 py-3 font-lp-body text-[12.5px] text-app-muted">
          Your direction is set to <strong className="text-app-charcoal">{direction.track === "higher_studies" ? "Higher studies" : "Entrepreneur"}</strong>. Listings are here if you want to keep options open;{" "}
          <Link href="/settings/direction" className="text-app-blue hover:underline">change direction</Link> any time.
        </p>
      )}

      {opportunities.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app-orange-container text-app-orange">
            <Rocket size={20} />
          </span>
          <h2 className="font-lp-display text-[17px] font-semibold text-app-charcoal">No open listings yet</h2>
          <p className="max-w-md font-lp-body text-[13px] text-app-muted">
            Internships and entry-level roles appear here when employers or your college&apos;s placement cell post them. Nothing is listed right now.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((opp) => {
            const matchedSkills = opp.skills.filter((s) => gapSkills.has(s));
            return (
              <div key={opp.id} className="flex flex-col gap-3 rounded-xl border border-app-border bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-lp-body text-[14.5px] font-semibold text-app-charcoal">{opp.role}</h3>
                    <p className="mt-0.5 flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted">
                      <Briefcase size={12} />
                      {opp.company}
                    </p>
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 font-lp-mono text-[10.5px] font-semibold ${TYPE_COLOR[opp.type]}`}>{TYPE_LABEL[opp.type]}</span>
                    {opp.campus && <span className="rounded-full border border-app-border px-2 py-0.5 font-lp-mono text-[10.5px] font-semibold text-app-charcoal">Visiting your campus</span>}
                  </span>
                </div>

                {opp.location && (
                  <p className="flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted">
                    <MapPin size={12} />
                    {opp.location}
                  </p>
                )}

                {opp.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {opp.skills.map((s) => (
                      <span
                        key={s}
                        className={`rounded-full border px-2 py-0.5 font-lp-mono text-[10.5px] ${
                          gapSkills.has(s) ? "border-app-orange text-app-orange" : "border-app-border text-app-muted"
                        }`}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {opp.campus && (opp.driveDate || opp.ctcOffered || opp.eligibleBranches.length > 0) && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-lp-body text-[12px]">
                    {opp.driveDate && (
                      <>
                        <dt className="text-app-muted">Visit date</dt>
                        <dd className="text-right text-app-charcoal">{new Date(opp.driveDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}</dd>
                      </>
                    )}
                    {opp.ctcOffered && (
                      <>
                        <dt className="text-app-muted">Package</dt>
                        <dd className="text-right text-app-charcoal">{opp.ctcOffered}</dd>
                      </>
                    )}
                    {opp.eligibleBranches.length > 0 && (
                      <>
                        <dt className="text-app-muted">Open to</dt>
                        <dd className="text-right text-app-charcoal">{opp.eligibleBranches.join(", ")}</dd>
                      </>
                    )}
                  </dl>
                )}

                {opp.eligibility && <p className="font-lp-body text-[12px] text-app-muted">{opp.eligibility}</p>}

                {opp.campus && (
                  <div>
                    {appliedStatus.has(opp.id) ? (
                      <span className="rounded-full border border-app-border px-2.5 py-1 font-lp-mono text-[11px] font-semibold text-app-charcoal">{APPLIED_LABEL[appliedStatus.get(opp.id)!] ?? "Registered"}</span>
                    ) : opp.driveStatus === "planned" ? (
                      <span className="font-lp-body text-[12px] text-app-muted">Registration opens soon</span>
                    ) : (
                      <ActionButton action="/api/launchpad/apply" body={{ opportunityId: opp.id }} label="Register" />
                    )}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-app-border pt-3">
                  <span className="font-lp-mono text-[10.5px] text-app-charcoal">
                    {opp.skills.length > 0 ? `${matchedSkills.length}/${opp.skills.length} skills to build` : ""}
                  </span>
                  {opp.deadline && (
                    <span className="flex items-center gap-1 font-lp-mono text-[10.5px] text-app-muted">
                      <Calendar size={11} />
                      {opp.deadline}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
