import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { matchCareersForStudent } from "@/lib/career/match";
import { getGuidePaths } from "@/lib/guide-path/read";
import { createServiceClient } from "@/lib/supabase/service";
import { loadLearning } from "@/lib/skillstudio/lesson";
import { nextPick, overall, recommended } from "@/lib/skillstudio/catalog";
import { gateModules, walkOrder } from "@/lib/skillstudio/sequence";
import { AreaHero } from "@/components/metro/AreaHero";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { GuidePathPanel } from "@/components/dashboard/GuidePathPanel";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";
import { ResumeBand } from "@/components/skillstudio/learn/ResumeBand";
import { CourseShelf } from "@/components/skillstudio/learn/CourseShelf";
import { UpNextList } from "@/components/skillstudio/learn/UpNextList";
import { Unavailable } from "@/components/skillstudio/learn/Unavailable";
import { RoleWelcome } from "@/components/skillstudio/RoleWelcome";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "SkillStudio — Capabilio AI" };

const MORE = 4;

/** SkillStudio for everyone: a student, a recent graduate or a professional sees the courses their own target role needs. */
export default async function SkillStudioPage({ searchParams }: { searchParams: Promise<{ welcome?: string; locked?: string }> }) {
  const { supabase, user } = await requireAuthedUser();
  const sp = await searchParams;
  const welcome = sp.welcome === "role";
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
        {welcome && "career" in load.reason && <RoleWelcome role={load.reason.career.name} />}
        <div className="flex flex-col gap-6 pt-6">
          <Unavailable reason={load.reason} />
          {top && guide && <GuidePathPanel careerRole={top.careerRole} initial={guide.primary} />}
        </div>
      </div>
    );
  }

  const { view } = load;
  const tally = overall(view.modules);
  // one module at a time: the path is shown in the order it is walked, and "up next" only ever comes from a module that is open
  const gates = gateModules(view.modules);
  const ordered = walkOrder(view.modules);
  const openModules = ordered.filter((m) => gates.get(m.key)?.gate !== "locked");
  const blocker = ordered.find((m) => gates.get(m.key)?.gate === "open");
  const pick = nextPick(openModules);
  const summary = `${tally.proven} of ${tally.lessons} lessons proven${tally.learning > 0 ? `, ${tally.learning} in progress` : ""}.`;

  return (
    <div className="ss-studio">
      {hero}
      {welcome && <RoleWelcome role={view.careerName} />}
      <div className="flex flex-col gap-6 pt-6">
        <LiveRefresh />
        {sp.locked && blocker && <p role="status" className="rounded-2xl border border-[var(--m-ink)] bg-white px-5 py-3 text-[14.5px] font-bold text-[var(--m-ink)]">That course is locked. Prove {blocker.title} first, then it opens.</p>}
        <ResumeBand pick={pick} careerName={view.careerName} summary={summary} />
        <CourseShelf modules={ordered} careerName={view.careerName} gates={Object.fromEntries(gates)} />
        <UpNextList picks={recommended(openModules, MORE)} />
      </div>
    </div>
  );
}
