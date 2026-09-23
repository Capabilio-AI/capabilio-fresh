import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { matchCareersForStudent } from "@/lib/career/match";
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
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">SkillStudio</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your personalized learning path, foundations, courses, and certifications.</p>
      <div className="mt-4">
        <SkillStudioSubNav />
      </div>
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
