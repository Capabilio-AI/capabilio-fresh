import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getStageState } from "@/lib/stage/server";
import { getLeaderboard } from "@/lib/arena/data";
import { loadArenaProfile } from "@/lib/arena/profile";
import { createServiceClient } from "@/lib/supabase/service";
import { getRoleTaskAvailability, type RoleTaskAvailability } from "@/lib/arena-workstations/availability";
import { SkillMatrix } from "@/components/arena/SkillMatrix";
import { RoleBuildingBanner } from "@/components/arena/RoleBuildingBanner";
import { ArenaSubNav } from "@/components/arena/ArenaSubNav";
import { AreaHero, HeroStat } from "@/components/metro/AreaHero";
import { LiveRefresh } from "@/components/live/LiveRefresh";
import { ProveYourCourses } from "@/components/arena/ProveYourCourses";
import { TRACKS } from "@/lib/languages";
import { loadModuleProofs } from "@/lib/languages/module-proof";
import { nextProof, type NextProof } from "@/lib/languages/next-proof";
import { loadExamLevels } from "@/lib/languages/year-exam";
import { loadProgress } from "@/lib/languages/progress";

export const metadata: Metadata = { title: "Arena | Capabilio AI", description: "Execute, compete, and prove your skills." };


export default async function ArenaHubPage() {
  const { supabase, user } = await requireAuthedUser();
  const [leaderboard, { stage }] = await Promise.all([getLeaderboard(supabase, user.id).catch(() => []), getStageState(user.id)]);
  // the skill profile reads the capability model; a problem loading it must never hide the rest of Arena
  const service = createServiceClient();
  const [profile, tasks] = await Promise.all([
    loadArenaProfile(service, user.id).catch(() => null),
    getRoleTaskAvailability(service, user.id, stage === "student").catch((): RoleTaskAvailability => ({ state: "unknown" })),
  ]);
  const viewer = leaderboard.find((e) => e.isViewer);
  // the next step to prove in each course the student has started; a problem reading it must never hide the rest of Arena
  const courseProofs = (await Promise.all(TRACKS.map(async (t): Promise<NextProof | null> => {
    const progress = await loadProgress(service, user.id, t.key).catch(() => ({}));
    return Object.keys(progress).length === 0 ? null : nextProof(t, progress, await loadModuleProofs(service, user.id, t.key).catch(() => ({})), await loadExamLevels(service, user.id, t.key).catch(() => []));
  }))).filter((x): x is NextProof => x !== null);

  return (
    <div className="flex flex-col gap-6">
      <LiveRefresh intervalMs={15_000} />
      <AreaHero
        tone="dark"
        title="Arena"
        intro="Where you execute. Timed challenges, projects and competitions that turn skill into proof."
        aside={<><HeroStat tone="dark" value={viewer ? viewer.rating : "Unrated"} label="Your rating" />{viewer && <HeroStat tone="dark" value={`#${viewer.rank}`} label="Your rank" />}</>}
        nav={<ArenaSubNav />}
      />

      {tasks.state === "building" && <RoleBuildingBanner careerName={tasks.careerName} />}

      <ProveYourCourses items={courseProofs} />

      {profile && <SkillMatrix rows={profile.rows} level={profile.level} careerName={profile.careerName} />}
    </div>
  );
}
