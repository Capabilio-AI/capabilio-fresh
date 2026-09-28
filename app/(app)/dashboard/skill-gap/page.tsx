import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { matchCareersForStudent } from "@/lib/career/match";
import { getSkillPracticeRecency } from "@/lib/career/skill-decay";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { SkillGapsTab } from "@/components/dashboard/SkillGapsTab";

export const metadata: Metadata = { title: "Skill Gap — Capabilio AI" };

export default async function SkillGapPage() {
  const { supabase, user } = await requireAuthedUser();

  const [careerMatches, practiceRecency] = await Promise.all([
    matchCareersForStudent(supabase, user.id),
    getSkillPracticeRecency(supabase, user.id),
  ]);

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Skill Gap</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        What each career target needs, compared with where you are today — critical gaps first, with how
        recently you&rsquo;ve practiced each skill in Arena.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>
      <div className="pt-6">
        <SkillGapsTab matches={careerMatches} practiceRecency={practiceRecency} />
      </div>
    </div>
  );
}
