import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { matchCareersForStudent } from "@/lib/career/match";
import { getGuidePaths } from "@/lib/guide-path/read";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { GuidePathPanel } from "@/components/dashboard/GuidePathPanel";

export const metadata: Metadata = { title: "My Path — SkillStudio — Capabilio AI" };

export default async function SkillStudioMyPathPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [careerMatches, guidePaths] = await Promise.all([
    matchCareersForStudent(supabase, user.id),
    getGuidePaths(supabase, user.id),
  ]);
  const top = careerMatches[0] ?? null;

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">SkillStudio</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your personalized learning path, foundations, courses, and certifications.</p>
      <div className="mt-4">
        <SkillStudioSubNav />
      </div>

      <div className="pt-6">
        {top ? (
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
