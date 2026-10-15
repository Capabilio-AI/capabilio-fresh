import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { matchCareersForStudent } from "@/lib/career/match";
import { getGuidePaths } from "@/lib/guide-path/read";
import { createServiceClient } from "@/lib/supabase/service";
import { loadLearning } from "@/lib/skillstudio/lesson";
import { nextPick, overall, recommended } from "@/lib/skillstudio/catalog";
import { AreaHero } from "@/components/metro/AreaHero";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { GuidePathPanel } from "@/components/dashboard/GuidePathPanel";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";
import { ResumeBand } from "@/components/skillstudio/learn/ResumeBand";
import { CourseShelf } from "@/components/skillstudio/learn/CourseShelf";
import { UpNextList } from "@/components/skillstudio/learn/UpNextList";
import { Unavailable } from "@/components/skillstudio/learn/Unavailable";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "SkillStudio — Capabilio AI" };

const MORE = 4;

/** SkillStudio for everyone: a student, a recent graduate or a professional sees the courses their own target role needs. */
export default async function SkillStudioPage() {
  const { supabase, user } = await requireAuthedUser();
  const load = await loadLearning(createServiceClient(), user.id);

  const hero = <AreaHero tone="tint" title="SkillStudio" intro="Learn what your role asks for, one lesson at a time, then prove it in Arena." nav={<SkillStudioSubNav />} />;

  if (!load.ok) {
    // A role without a published path still gets the AI-sequenced plan from the person's own skill gaps.
    const matches = load.reason.state === "NO_TEMPLATE" ? await matchCareersForStudent(supabase, user.id) : [];
    const top = matches[0] ?? null;
    const guide = top ? await getGuidePaths(supabase, user.id) : null;
    return (
      <div className="ss-studio">
        {hero}
        <div className="flex flex-col gap-6 pt-6">
          <Unavailable reason={load.reason} />
          {top && guide && <GuidePathPanel careerRole={top.careerRole} initial={guide.primary} />}
        </div>
      </div>
    );
  }

  const { view } = load;
  const tally = overall(view.modules);
  const pick = nextPick(view.modules);
  const summary = `${tally.proven} of ${tally.lessons} lessons proven${tally.learning > 0 ? `, ${tally.learning} in progress` : ""}.`;

  return (
    <div className="ss-studio">
      {hero}
      <div className="flex flex-col gap-6 pt-6">
        <LiveRefresh />
        <ResumeBand pick={pick} careerName={view.careerName} summary={summary} />
        <CourseShelf modules={view.modules} careerName={view.careerName} />
        <UpNextList picks={recommended(view.modules, MORE)} />
      </div>
    </div>
  );
}
