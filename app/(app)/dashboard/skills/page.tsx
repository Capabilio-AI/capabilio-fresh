import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getSkills } from "@/lib/dashboard/data";
import { matchCareersForStudent } from "@/lib/career/match";
import { getSkillPracticeRecency } from "@/lib/career/skill-decay";
import { gapTier } from "@/lib/career/skill-gap";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { SegmentedLinks } from "@/components/dashboard/SegmentedLinks";
import { SkillsTab } from "@/components/dashboard/SkillsTab";
import { SkillGapsTab } from "@/components/dashboard/SkillGapsTab";

export const metadata: Metadata = { title: "Skills & Gaps — Capabilio AI" };

const TOP_CAREERS_FOR_RELEVANCE = 3;

export default async function SkillsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const showGaps = view === "gaps";
  const { supabase, user } = await requireAuthedUser();

  const [skills, careerMatches, practiceRecency] = await Promise.all([
    getSkills(supabase, user.id),
    matchCareersForStudent(supabase, user.id),
    getSkillPracticeRecency(supabase, user.id),
  ]);

  // "Relevant" = named as a requirement by one of the student's closest career matches, from the same
  // skill_gap data shown in the Gaps view. Every measured skill stays behind "All skills".
  const relevantSkills = new Set(
    careerMatches.slice(0, TOP_CAREERS_FOR_RELEVANCE).flatMap((m) => m.skillGaps.map((g) => g.skill))
  );
  const criticalGaps = new Set(
    careerMatches.flatMap((m) => m.skillGaps.filter((g) => gapTier(g.gap) === "critical").map((g) => g.skill))
  ).size;

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Skills &amp; Gaps</h1>
      <p className="mt-1 max-w-2xl font-lp-body text-[13px] text-app-muted">
        What you can do today, and what each career target still needs from you.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>

      <div className="flex flex-col gap-6 pt-6">
        <SegmentedLinks
          label="Skills view"
          segments={[
            { label: "My skills", href: "/dashboard/skills", detail: String(skills.length), active: !showGaps },
            {
              label: "Skill gaps",
              href: "/dashboard/skills?view=gaps",
              detail: criticalGaps > 0 ? `${criticalGaps} critical` : undefined,
              active: showGaps,
            },
          ]}
        />
        {showGaps ? (
          <SkillGapsTab matches={careerMatches} practiceRecency={practiceRecency} />
        ) : (
          <SkillsTab skills={skills} relevantSkills={relevantSkills} />
        )}
      </div>
    </div>
  );
}
