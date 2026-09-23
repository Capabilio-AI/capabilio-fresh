import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { matchCareersForStudent } from "@/lib/career/match";
import { getGuidePaths } from "@/lib/guide-path/read";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { GuidePathPanel } from "@/components/dashboard/GuidePathPanel";
import { TIER_CONTAINER, scoreTier } from "@/components/dashboard/tier";

export const metadata: Metadata = { title: "Career Path — Capabilio AI" };

export default async function CareerPathPage() {
  const { supabase, user } = await requireAuthedUser();

  const [careerMatches, guidePaths] = await Promise.all([
    matchCareersForStudent(supabase, user.id),
    getGuidePaths(supabase, user.id),
  ]);
  const top = careerMatches[0] ?? null;

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Career Path</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Your recommended direction, and a phased plan to close the gap.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>

      <div className="flex flex-col gap-6 pt-6">
        {top && (
          <div>
            <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">
              Your plan: {top.careerRole}
            </h2>
            <div className="mt-3">
              <GuidePathPanel careerRole={top.careerRole} initial={guidePaths.primary} />
            </div>
          </div>
        )}

        <div id="explore">
          <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Explore careers</h2>
          <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
            Every career role compared against your assessed skills. Readiness is computed, not predicted.
          </p>
          {careerMatches.length === 0 ? (
            <p className="mt-4 font-lp-body text-[13px] text-app-muted">
              No career requirements to compare against yet.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {careerMatches.map((match) => {
                const tier = scoreTier(match.overallReadiness);
                return (
                  <div key={match.careerRole} className="rounded-xl border border-app-border bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-lp-body text-[14px] font-semibold text-app-charcoal">
                        {match.careerRole}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 font-lp-mono text-[10.5px] font-semibold ${TIER_CONTAINER[tier]}`}
                      >
                        {match.overallReadiness}%
                      </span>
                    </div>
                    <p className="mt-2 font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">
                      {match.recommendation}
                    </p>
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
