import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { matchCareersForStudent } from "@/lib/career/match";
import { AreaHero } from "@/components/metro/AreaHero";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { MOCK_COURSES } from "@/lib/mock/skillstudio";
import { CatalogGrid } from "@/components/skillstudio/CatalogGrid";

export const metadata: Metadata = { title: "Courses — SkillStudio — Capabilio AI" };

export default async function CoursesPage() {
  const { supabase, user } = await requireAuthedUser();

  const careerMatches = await matchCareersForStudent(supabase, user.id);
  const gapSkills = new Set((careerMatches[0]?.skillGaps ?? []).filter((g) => g.gap > 0).map((g) => g.skill));

  return (
    <div>
      <AreaHero tone="tint" title="SkillStudio" intro="Your personalized learning path, foundations, courses, and certifications." nav={<SkillStudioSubNav />} />
      <div className="pt-6">
        <CatalogGrid
          items={MOCK_COURSES.map((c) => ({
            id: c.id,
            title: c.title,
            level: c.level,
            skills: c.skills,
            meta: `${c.provider} · ${c.durationHours}h`,
            matchesGap: c.skills.some((s) => gapSkills.has(s)),
          }))}
        />
      </div>
    </div>
  );
}
