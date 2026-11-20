import { redirect } from "next/navigation";
import Link from "next/link";
import { LiveRefresh } from "@/components/live/LiveRefresh";
import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getDashboardData, getSkills, DashboardNotReadyError } from "@/lib/dashboard/data";
import { matchCareersForStudent, normalizeRole } from "@/lib/career/match";
import { getVaultItems } from "@/lib/vault/data";
import { computeNextAction } from "@/lib/dashboard/next-action";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { explainRecommendation } from "@/lib/career/explain-recommendation";
import { CareerDirectionExplainerModal } from "@/components/dashboard/CareerDirectionExplainerModal";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { CareerDirectionCard } from "@/components/dashboard/CareerDirectionCard";
import { YourPathCard } from "@/components/dashboard/YourPathCard";
import { studentPhase } from "@/lib/student/phase";
import { chosenRoleName, studentHasRole } from "@/lib/careers/has-role";
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
import { ChangeRoleDialog } from "@/components/dashboard/ChangeRoleDialog";
import { roleChangeState } from "@/lib/careers/role-change";
import { OverviewHub } from "@/components/dashboard/OverviewHub";
import { buildOverview } from "@/lib/dashboard/overview";
import { getCareerProfile } from "@/lib/assess/career-profile";
import { OnboardingGate } from "@/components/assess/OnboardingGate";
import { studentGate } from "@/lib/assess/gate";
import type { Db } from "@/lib/assess/db";
import { getStageState } from "@/lib/stage/server";
import { interviewUnlocked } from "@/lib/plans/catalog";
import { loadGraduateHome } from "@/lib/graduate/home";
import { GraduateHome } from "@/components/graduate/GraduateHome";
import { CrtDueCard } from "@/components/crt/CrtDueCard";
import { loadCrtDue, type CrtDue } from "@/lib/crt/server";

export const metadata: Metadata = {
  title: "Dashboard — Capabilio AI",
  description: "Your career direction, capability, and next best action.",
};

export default async function DashboardPage() {
  const { supabase, user } = await requireAuthedUser();

  // Recently graduated and professional profiles have their own homes: no programme year, no roadmap, no Plan B.
  // The onboarding gate is read alongside the stage (both read-only); only students use it.
  const service = createServiceClient();
  const [state, gate] = await Promise.all([getStageState(user.id), studentGate(service as unknown as Db, user.id)]);
  if (state.stage !== "student") {
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    if (state.stage === "professional") redirect("/professional"); // professionals have their own pages
    const canInterview = interviewUnlocked("graduate", state.planId, false);
    return <GraduateHome data={await loadGraduateHome(supabase, user.id, me?.full_name ?? null, canInterview)} interviewUnlocked={canInterview} />;
  }

  // A first-time student sees only the onboarding shell until the career assessment is analysed (never the full dashboard).
  if (gate.locked && gate.status) return <OnboardingGate status={gate.status} feature="your dashboard" />;

  // No role chosen: show the assessment and nothing else. No recommendation, readiness, skills or next action is made up for a role they never picked.
  if (!(await studentHasRole(service, user.id))) {
    const year = (await getStudentDirection(service, user.id))?.academicYear?.year ?? null;
    const phase = studentPhase(year, false) as Exclude<ReturnType<typeof studentPhase>, "role">;
    let plain: Awaited<ReturnType<typeof getDashboardData>>;
    try {
      plain = await getDashboardData(supabase, user.id, { lenient: true });
    } catch (error) {
      if (error instanceof DashboardNotReadyError) redirect("/assessment");
      throw error;
    }
    return (
      <div>
        <LiveRefresh />
        <DashboardHeader data={plain} hideScore />
        <DashboardSubNav />
        <div className="flex flex-col gap-5 pt-6">
          <YourPathCard phase={phase} />
          <AssessmentResults data={plain} />
        </div>
      </div>
    );
  }

  let data: Awaited<ReturnType<typeof getDashboardData>>;
  let skills: Awaited<ReturnType<typeof getSkills>>;
  let careerMatches: Awaited<ReturnType<typeof matchCareersForStudent>>;
  let vaultItems: Awaited<ReturnType<typeof getVaultItems>>;
  let statedInterest: string | null;
  let hasSeenIntro: boolean;
  let rollNotice: Awaited<ReturnType<typeof loadRollNumberNotice>>;
  let direction: Awaited<ReturnType<typeof getStudentDirection>>;
  let careerProfile: Awaited<ReturnType<typeof getCareerProfile>>;
  let crtDue: CrtDue | null;
  try {
    const [dashboardData, skillRows, matches, vault, interest, { data: profile }, roll, dir, career, crt] = await Promise.all([
      getDashboardData(supabase, user.id, { lenient: true }),
      getSkills(supabase, user.id),
      matchCareersForStudent(supabase, user.id),
      getVaultItems(supabase, user.id),
      getStatedCareerInterest(supabase, user.id),
      supabase.from("profiles").select("has_seen_career_direction_intro").eq("id", user.id).single(),
      loadRollNumberNotice(service, user.id),
      getStudentDirection(service, user.id),
      getCareerProfile(service as unknown as Db, user.id),
      loadCrtDue(service, user.id).catch(() => null),
    ]);
    crtDue = crt;
    rollNotice = roll;
    direction = dir;
    careerProfile = career;
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

  const overview = buildOverview(careerProfile);
  // "Change role" is offered only while the student has changes left; null means role changes are not set up yet, so nothing is offered.
  const [changeState, { data: roleIds }] = await Promise.all([
    roleChangeState(service, user.id),
    service.from("student_career_intent").select("primary_career_id, secondary_career_id").eq("student_id", user.id).maybeSingle(),
  ]);
  // Plan B is asked from 3rd year onward, and never again once a real choice is saved.
  const planBAsk = direction?.planBOpen ? await getCareerIntent(service, user.id) : null;
  const askPlanB = planBAsk && !planBAsk.intent.planBKind ? planBAsk : null;
  // Direction and next action are about the role the student chose, never another role that happens to score highest: with no skill data every role scores the same.
  const chosenRole = await chosenRoleName(service, user.id);
  const topMatch = chosenRole ? careerMatches.find((m) => normalizeRole(m.careerRole) === normalizeRole(chosenRole)) ?? null : null;
  const nextAction = computeNextAction(topMatch);
  const showCareerDirectionIntro = !hasSeenIntro && topMatch !== null && Boolean(statedInterest);

  return (
    <div>
      <LiveRefresh />
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
      {crtDue && <CrtDueCard due={crtDue} />}
      {planBAsk?.intent.planBSwitchPending && planBAsk.intent.secondary && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app-border bg-white p-4">
          <div className="max-w-[60ch]">
            <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">Finish moving to {planBAsk.intent.secondary.name}</p>
            <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">{planBAsk.intent.primary?.name ?? "Your current role"} stays your main role until you complete the {planBAsk.intent.secondary.name} assessment. Then everything switches over.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/assessment/switch" className="min-h-10 rounded-lg border border-app-border px-4 py-2.5 font-lp-body text-[13px] font-medium text-app-charcoal">Pick a different role</Link>
            <Link href="/assessment?plan=b" className="min-h-10 rounded-lg bg-app-charcoal px-4 py-2.5 font-lp-body text-[13px] font-medium text-white">Take the assessment</Link>
          </div>
        </div>
      )}
      {askPlanB && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app-border bg-white p-4">
          <div className="max-w-[60ch]">
            <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">Choose your Plan B</p>
            <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">You&apos;re in 3rd year. Tell us what you would do if your main plan changes. You are asked once.</p>
          </div>
          <PlanBDialog autoOpen mainCareer={askPlanB.intent.primary?.name ?? null} />
        </div>
      )}
      {changeState && roleIds?.primary_career_id && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app-border bg-white px-4 py-3">
          <p className="font-lp-body text-[13px] text-app-muted">Your role: <span className="font-semibold text-app-charcoal">{chosenRole}</span> · {changeState.left} of {changeState.limit} role changes left</p>
          {changeState.left > 0 && (
            <ChangeRoleDialog
              standing={{ roleName: chosenRole ?? "your role", elo: overview?.elo ?? null, tier: overview?.tier.label ?? null, proven: overview?.proven ?? null, total: overview?.total ?? null, activity: careerProfile.elo?.events ?? null }}
              currentRoleId={roleIds.primary_career_id}
              planBRoleId={roleIds.secondary_career_id}
              left={changeState.left}
              limit={changeState.limit}
            />
          )}
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
              <CareerDirectionCard match={topMatch} chosenRole={chosenRole} />
              <CapabilityCard skills={skills} />
            </div>
            <NextActionCard action={nextAction} chosenRole={chosenRole} />
            <AssessmentResults data={data} />
          </>
        )}
      </div>
    </div>
  );
}
