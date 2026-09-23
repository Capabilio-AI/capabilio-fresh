import type { Metadata } from "next";
import { Briefcase, Calendar, Lock, MapPin, Rocket } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { matchCareersForStudent } from "@/lib/career/match";
import { currentStageIndex, isStageUnlocked, JOURNEY_STAGES, UNLOCK_STAGE_KEY } from "@/lib/journey/stage";
import { MOCK_OPPORTUNITIES, type OpportunityType } from "@/lib/mock/launchpad";

export const metadata: Metadata = { title: "Launchpad — Capabilio AI" };

const TYPE_COLOR: Record<OpportunityType, string> = {
  Job: "bg-app-success-container text-app-success",
  Internship: "bg-app-blue-container text-app-blue",
  Competition: "bg-app-warning-container text-app-warning",
  Referral: "bg-app-orange-container text-app-orange",
};

export default async function LaunchpadPage() {
  const { supabase, user } = await requireAuthedUser();

  const [viewer, careerMatches] = await Promise.all([
    getViewerSummary(supabase, user.id),
    matchCareersForStudent(supabase, user.id),
  ]);

  const unlocked = isStageUnlocked(viewer.year, UNLOCK_STAGE_KEY);

  if (!unlocked) {
    const stage = JOURNEY_STAGES[currentStageIndex(viewer.year)];
    const targetStage = JOURNEY_STAGES.find((s) => s.key === UNLOCK_STAGE_KEY)!;
    return (
      <div>
        <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Launchpad</h1>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">Jobs, internships, competitions, and referrals.</p>

        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-app-border bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app-attention-container text-app-attention">
            <Lock size={20} />
          </span>
          <h2 className="font-lp-display text-[18px] font-semibold text-app-charcoal">Not unlocked yet</h2>
          <p className="max-w-md font-lp-body text-[13.5px] text-app-muted">
            Complete your {targetStage.label} ({targetStage.yearSemester}) career development stage to unlock jobs
            and internships.
          </p>
          <p className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">
            You're currently at: {stage.label} ({stage.yearSemester})
          </p>
          <button
            type="button"
            disabled
            className="mt-2 cursor-not-allowed rounded-lg bg-app-border px-5 py-2.5 font-lp-body text-[13px] font-semibold text-app-muted"
          >
            Locked
          </button>
        </div>
      </div>
    );
  }

  const gapSkills = new Set((careerMatches[0]?.skillGaps ?? []).map((g) => g.skill));

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Launchpad</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Jobs, internships, competitions, and referrals.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_OPPORTUNITIES.map((opp) => {
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
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-lp-mono text-[10.5px] font-semibold ${TYPE_COLOR[opp.type]}`}>
                  {opp.type}
                </span>
              </div>

              <p className="flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted">
                <MapPin size={12} />
                {opp.location}
              </p>

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

              <p className="font-lp-body text-[12px] text-app-muted">{opp.eligibility}</p>

              <div className="mt-auto flex items-center justify-between border-t border-app-border pt-3">
                <span className="font-lp-mono text-[10.5px] text-app-charcoal">
                  {matchedSkills.length}/{opp.skills.length} skills align
                </span>
                <span className="flex items-center gap-1 font-lp-mono text-[10.5px] text-app-muted">
                  <Calendar size={11} />
                  {opp.deadline}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-lg border border-dashed border-app-border bg-white px-4 py-3 font-lp-body text-[12px] text-app-muted">
        <Rocket size={14} className="text-app-orange" />
        Live opportunity listings are in development — these are sample roles to show the format.
      </div>
    </div>
  );
}
