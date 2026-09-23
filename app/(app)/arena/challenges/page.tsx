import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { ArenaView } from "@/components/arena/ArenaView";
import { ArenaSubNav } from "@/components/arena/ArenaSubNav";

export const metadata: Metadata = {
  title: "Challenges — Arena — Capabilio AI",
  description: "Timed challenges and the ELO leaderboard.",
};

export default async function ArenaChallengesPage() {
  const { supabase, user } = await requireAuthedUser();

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Arena</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Timed challenges, projects, and competitions.</p>
      <div className="mt-4">
        <ArenaSubNav />
      </div>
      <div className="flex justify-center pt-6">
        <ArenaView />
      </div>
    </div>
  );
}
