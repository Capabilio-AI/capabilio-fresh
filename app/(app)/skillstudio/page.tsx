import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { matchCareersForStudent } from "@/lib/career/match";
import { getGuidePaths } from "@/lib/guide-path/read";
import { AreaHero } from "@/components/metro/AreaHero";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { GuidePathPanel } from "@/components/dashboard/GuidePathPanel";
import { ModuleCards } from "@/components/skillstudio/ModuleCards";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";
import { loadModules } from "@/lib/skillstudio/modules";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "My Path — SkillStudio — Capabilio AI" };

export default async function SkillStudioMyPathPage() {
  const { supabase, user } = await requireAuthedUser();

  const [careerMatches, guidePaths, modules] = await Promise.all([
    matchCareersForStudent(supabase, user.id),
    getGuidePaths(supabase, user.id),
    loadModules(createServiceClient(), user.id),
  ]);
  const top = careerMatches[0] ?? null;

  return (
    <div>
      <AreaHero tone="tint" title="SkillStudio" intro="Everything for your chosen career: the modules to learn and the certifications to earn." nav={<SkillStudioSubNav />} />

      <div className="pt-6">
        <LiveRefresh />
        {modules && modules.modules.length > 0 ? (
          <ModuleCards view={modules} />
        ) : top ? (
          <>
            <p className="mb-3 font-lp-body text-[13px] text-app-muted">
              Sequenced for <span className="font-semibold text-app-charcoal">{top.careerRole}</span> — your top
              career match, against your actual skill gaps.
            </p>
            <GuidePathPanel careerRole={top.careerRole} initial={guidePaths.primary} />
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
            <p className="font-lp-body text-[13.5px] text-app-muted">
              Complete your assessment to get a personalized learning path.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
