import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getCareerProfile } from "@/lib/assess/career-profile";
import { gapMatchFromProfile } from "@/lib/assess/gap-match";
import { studentGate } from "@/lib/assess/gate";
import { OnboardingGate } from "@/components/assess/OnboardingGate";
import { CommonProgress } from "@/components/assess/result/CommonProgress";
import { ProfileEloCard } from "@/components/assess/result/ProfileViews";
import { SkillGapsTab } from "@/components/dashboard/SkillGapsTab";
import { SkillGapAnalysis } from "@/components/dashboard/SkillGapAnalysis";
import { loadGapSkills } from "@/lib/dashboard/skill-groups";
import { EmptyState } from "@/components/dashboard/SkillsTab";
import { PageHead } from "@/components/dashboard/PageHead";
import { SegmentedLinks } from "@/components/dashboard/SegmentedLinks";
import { getSkillPracticeRecency } from "@/lib/career/skill-decay";
import type { Db } from "@/lib/assess/db";

export const metadata: Metadata = { title: "Skills — Capabilio AI" };

export default async function SkillsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const showGaps = (await searchParams).view === "gaps";
  const { supabase, user } = await requireAuthedUser();
  const db = createServiceClient() as unknown as Db;
  const gate = await studentGate(db, user.id);
  if (gate.locked && gate.status) return <OnboardingGate status={gate.status} feature="your skills" />;
  // One object feeds both sections: the assessment builds it, and every verified Arena mission updates it.
  const [profile, practiceRecency] = await Promise.all([getCareerProfile(db, user.id), getSkillPracticeRecency(supabase, user.id)]);
  const match = gapMatchFromProfile(profile);
  const gapSkills = showGaps && match ? await loadGapSkills(createServiceClient(), user.id, profile) : [];
  const critical = match ? match.skillGaps.filter((g) => g.current !== null && g.gap > 10).length : 0;
  return (
    <div>
      <PageHead title="Skills" intro="Where you stand on every skill your role needs and what the market asks for. It updates as you complete Arena missions." />
      <div className="flex flex-col gap-5 pt-4">
        <SegmentedLinks
          label="Skills view"
          segments={[
            { label: "Skill graph", href: "/dashboard/skills", active: !showGaps },
            { label: "Skill gap analysis", href: "/dashboard/skills?view=gaps", detail: critical > 0 ? `${critical} critical` : undefined, active: showGaps },
          ]}
        />
        {!showGaps && <ProfileEloCard initial={profile} />}
        {match && showGaps ? <SkillGapAnalysis roleName={match.careerRole} readiness={profile.readiness} skills={gapSkills} /> : match ? <SkillGapsTab matches={[match]} practiceRecency={practiceRecency} section="graph" /> : <EmptyState message="Choose a career direction and finish the assessment to see your skills." />}
        {!showGaps && profile.common && <CommonProgress bars={profile.common} />}
      </div>
    </div>
  );
}
