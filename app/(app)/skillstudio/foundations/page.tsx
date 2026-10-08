import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { matchCareersForStudent } from "@/lib/career/match";
import { AreaHero } from "@/components/metro/AreaHero";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { MOCK_FOUNDATIONS } from "@/lib/mock/skillstudio";
import { CatalogGrid } from "@/components/skillstudio/CatalogGrid";

export const metadata: Metadata = { title: "Foundations — SkillStudio — Capabilio AI" };

export default async function FoundationsPage() {
  const { supabase, user } = await requireAuthedUser();

  const careerMatches = await matchCareersForStudent(supabase, user.id);
  const gapSkills = new Set((careerMatches[0]?.skillGaps ?? []).filter((g) => g.gap > 0).map((g) => g.skill));

  return (
    <div>
      <AreaHero tone="tint" title="SkillStudio" intro="Your personalized learning path, foundations, courses, and certifications." nav={<SkillStudioSubNav />} />
      <div className="pt-6">
        <CatalogGrid
          items={MOCK_FOUNDATIONS.map((f) => ({
            id: f.id,
            title: f.title,
            level: f.level,
            skills: [f.skill],
            description: f.description,
            matchesGap: gapSkills.has(f.skill),
          }))}
        />
      </div>
    </div>
  );
}
