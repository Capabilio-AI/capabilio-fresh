import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getSkills } from "@/lib/dashboard/data";
import { matchCareersForStudent } from "@/lib/career/match";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { SkillsTab } from "@/components/dashboard/SkillsTab";

export const metadata: Metadata = { title: "Skills — Capabilio AI" };

const TOP_CAREERS_FOR_RELEVANCE = 3;

export default async function SkillsPage() {
  const { supabase, user } = await requireAuthedUser();

  const [skills, careerMatches] = await Promise.all([
    getSkills(supabase, user.id),
    matchCareersForStudent(supabase, user.id),
  ]);

  // "Relevant" = named as a requirement by one of the student's closest
  // career matches — not a guess, it's the same skill_gap data shown on
  // Career Path/Skill Gap. Every skill the assessment actually measured
  // is still available behind "All skills"; nothing is hidden, only the
  // default view is narrowed to what's actionable for their direction.
  const relevantSkills = new Set(
    careerMatches.slice(0, TOP_CAREERS_FOR_RELEVANCE).flatMap((m) => m.skillGaps.map((g) => g.skill))
  );

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Skills</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your capability by skill, grouped by domain.</p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>
      <div className="pt-6">
        <SkillsTab skills={skills} relevantSkills={relevantSkills} />
      </div>
    </div>
  );
}
