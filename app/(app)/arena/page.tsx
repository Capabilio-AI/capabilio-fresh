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

      {profile && <SkillMatrix rows={profile.rows} level={profile.level} careerName={profile.careerName} />}
    </div>
  );
}
