import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getDashboardData, getSkills, DashboardNotReadyError } from "@/lib/dashboard/data";
import { matchCareersForStudent } from "@/lib/career/match";
import { getVaultItems } from "@/lib/vault/data";
import { computeNextAction } from "@/lib/dashboard/next-action";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { explainRecommendation } from "@/lib/career/explain-recommendation";
import { CareerDirectionExplainerModal } from "@/components/dashboard/CareerDirectionExplainerModal";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { CareerDirectionCard } from "@/components/dashboard/CareerDirectionCard";
import { CapabilityCard } from "@/components/dashboard/CapabilityCard";
import { NextActionCard } from "@/components/dashboard/NextActionCard";
import { AssessmentResults } from "@/components/dashboard/AssessmentResults";
import { TrackPanel } from "@/components/direction/TrackPanel";
import { RollNumberBanner } from "@/components/direction/RollNumberBanner";
import { loadRollNumberNotice } from "@/lib/org/roll-number";
import { createServiceClient } from "@/lib/supabase/service";
import { getStudentDirection } from "@/lib/career/direction";
import { getCareerIntent } from "@/lib/careers/intent";
import { PlanBDialog } from "@/components/direction/PlanBDialog";
import { OverviewHub } from "@/components/dashboard/OverviewHub";
import { buildOverview } from "@/lib/dashboard/overview";
import { getCareerProfile } from "@/lib/assess/career-profile";
import { OnboardingGate } from "@/components/assess/OnboardingGate";
import { studentGate } from "@/lib/assess/gate";
import type { Db } from "@/lib/assess/db";

export const metadata: Metadata = {
  title: "Dashboard — Capabilio AI",
  description: "Your career direction, capability, and next best action.",
};

export default async function DashboardPage() {
  const { supabase, user } = await requireAuthedUser();

  // A first-time student sees only the onboarding shell until the career assessment is analysed (never the full dashboard).
  const gate = await studentGate(createServiceClient() as unknown as Db, user.id);
  if (gate.locked && gate.status) return <OnboardingGate status={gate.status} feature="your dashboard" />;

  let data: Awaited<ReturnType<typeof getDashboardData>>;
  let skills: Awaited<ReturnType<typeof getSkills>>;
  let careerMatches: Awaited<ReturnType<typeof matchCareersForStudent>>;
  let vaultItems: Awaited<ReturnType<typeof getVaultItems>>;
  let statedInterest: string | null;
  let hasSeenIntro: boolean;
  try {
    const [dashboardData, skillRows, matches, vault, interest, { data: profile }] = await Promise.all([
      getDashboardData(supabase, user.id, { lenient: true }),
      getSkills(supabase, user.id),
      matchCareersForStudent(supabase, user.id),
      getVaultItems(supabase, user.id),
      getStatedCareerInterest(supabase, user.id),
      supabase.from("profiles").select("has_seen_career_direction_intro").eq("id", user.id).single(),
    ]);
    data = dashboardData;
    skills = skillRows;
    careerMatches = matches;
    vaultItems = vault;
    statedInterest = interest;
    hasSeenIntro = profile?.has_seen_career_direction_intro ?? true;
  } catch (error) {
    if (error instanceof DashboardNotReadyError) {
      redirect("/assessment");
    }
    throw error;
  }

  const service = createServiceClient();
  const [rollNotice, direction, careerProfile] = await Promise.all([loadRollNumberNotice(service, user.id), getStudentDirection(service, user.id), getCareerProfile(service as unknown as Db, user.id)]);
  const overview = buildOverview(careerProfile);
  // Plan B is asked once, in 3-1, and never again after one is saved.
  const planBAsk = direction?.planBOpen ? await getCareerIntent(service, user.id) : null;
  const askPlanB = planBAsk && !planBAsk.intent.planBKind ? planBAsk : null;
  const topMatch = careerMatches[0] ?? null;
  const nextAction = computeNextAction(topMatch);
  const showCareerDirectionIntro = !hasSeenIntro && topMatch !== null && Boolean(statedInterest);

  return (
    <div>
      {showCareerDirectionIntro && topMatch && statedInterest && (
        <CareerDirectionExplainerModal
          statedInterest={statedInterest}
          recommendedRole={topMatch.careerRole}
          readiness={topMatch.overallReadiness}
          explanation={explainRecommendation(topMatch, statedInterest)}
        />
      )}
      <DashboardHeader data={data} hideScore={Boolean(overview)} />
      {rollNotice && <div className="pb-2"><RollNumberBanner notice={rollNotice} /></div>}
      {askPlanB && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app-border bg-white p-4">
          <div className="max-w-[60ch]">
            <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">Choose your Plan B</p>
            <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">You&apos;re in 3rd year, 1st semester. Tell us what you would do if your main plan changes. You are asked once.</p>
          </div>
          <PlanBDialog autoOpen mainCareer={askPlanB.intent.primary?.name ?? null} careers={askPlanB.careers.filter((c) => c.id !== askPlanB.intent.primary?.id)} />
        </div>
      )}
      <div className="empty:hidden pb-2">
        <TrackPanel supabase={supabase} userId={user.id} />
      </div>
      <DashboardSubNav />

      <div className="flex flex-col gap-5 pt-6">
        {overview ? (
          <OverviewHub o={overview} vaultCount={vaultItems.length} yearLabel={data.yearLabel} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
              <CareerDirectionCard match={topMatch} />
              <CapabilityCard skills={skills} />
            </div>
            <NextActionCard action={nextAction} />
            <AssessmentResults data={data} />
          </>
        )}
      </div>
    </div>
  );
}
