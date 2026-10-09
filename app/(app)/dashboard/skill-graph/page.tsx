import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getCareerProfile } from "@/lib/assess/career-profile";
import { studentGate } from "@/lib/assess/gate";
import { OnboardingGate } from "@/components/assess/OnboardingGate";
import { CommonProgress } from "@/components/assess/result/CommonProgress";
import { ProfileEloCard, ProfileSkillGraph, ProfileSkills } from "@/components/assess/result/ProfileViews";
import { PageHead } from "@/components/dashboard/PageHead";
import type { Db } from "@/lib/assess/db";

export const metadata: Metadata = { title: "Skill Graph — Capabilio AI" };

export default async function SkillGraphPage() {
  const { user } = await requireAuthedUser();
  const db = createServiceClient() as unknown as Db;
  const gate = await studentGate(db, user.id);
  if (gate.locked && gate.status) return <OnboardingGate status={gate.status} feature="your skill graph" />;
  // the same object the popup, the ELO card and the Skills section read
  const profile = await getCareerProfile(db, user.id);
  return (
    <div>
      <PageHead title="Skill Graph" intro="Every skill your role needs, what you can do today, and how sure we are." />
      <div className="flex flex-col gap-5 pt-6">
        <ProfileEloCard initial={profile} />
        <ProfileSkillGraph initial={profile} />
        <ProfileSkills initial={profile} />
        {profile.common && <CommonProgress bars={profile.common} />}
      </div>
    </div>
  );
}
