import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getDashboardData, getSkills, DashboardNotReadyError } from "@/lib/dashboard/data";
import { matchCareersForStudent } from "@/lib/career/match";
import { getVaultItems } from "@/lib/vault/data";
import { computeNextAction } from "@/lib/dashboard/next-action";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { CareerDirectionCard } from "@/components/dashboard/CareerDirectionCard";
import { CapabilityCard } from "@/components/dashboard/CapabilityCard";
import { NextActionCard } from "@/components/dashboard/NextActionCard";
import { AssessmentResults } from "@/components/dashboard/AssessmentResults";
import {
  CurrentProjectCard,
  MentorInsightCard,
  ProofPortfolioPreview,
  SkillGapsPreviewCard,
} from "@/components/dashboard/SecondaryCards";
import { JourneyTimeline } from "@/components/dashboard/JourneyTimeline";

export const metadata: Metadata = {
  title: "Dashboard — Capabilio AI",
  description: "Your career direction, capability, and next best action.",
};

export default async function DashboardPage() {
  const { supabase, user } = await requireAuthedUser();

  let data: Awaited<ReturnType<typeof getDashboardData>>;
  let skills: Awaited<ReturnType<typeof getSkills>>;
  let careerMatches: Awaited<ReturnType<typeof matchCareersForStudent>>;
  let vaultItems: Awaited<ReturnType<typeof getVaultItems>>;
  try {
    [data, skills, careerMatches, vaultItems] = await Promise.all([
      getDashboardData(supabase, user.id),
      getSkills(supabase, user.id),
      matchCareersForStudent(supabase, user.id),
      getVaultItems(supabase, user.id),
    ]);
  } catch (error) {
    if (error instanceof DashboardNotReadyError) {
      redirect("/assessment");
    }
    throw error;
  }

  const topMatch = careerMatches[0] ?? null;
  const nextAction = computeNextAction(topMatch);

  return (
    <div>
      <DashboardHeader data={data} />
      <DashboardSubNav />

      <div className="flex flex-col gap-5 pt-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
          <CareerDirectionCard match={topMatch} />
          <CapabilityCard skills={skills} />
        </div>

        <NextActionCard action={nextAction} />

        <AssessmentResults data={data} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SkillGapsPreviewCard match={topMatch} />
          <CurrentProjectCard />
          <MentorInsightCard action={nextAction} />
          <ProofPortfolioPreview items={vaultItems} />
        </div>

        <JourneyTimeline year={data.year} />
      </div>
    </div>
  );
}
