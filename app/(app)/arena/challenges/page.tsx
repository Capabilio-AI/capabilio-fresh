import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { ArenaChallengesBoard } from "@/components/arena/ArenaChallengesBoard";
import { ArenaSubNav } from "@/components/arena/ArenaSubNav";

export const metadata: Metadata = {
  title: "Challenges — Arena — Capabilio AI",
  description: "Weekly Stream and Domain challenges, picked for your branch and career.",
};

export default async function ArenaChallengesPage() {
  await requireAuthedUser();

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Arena</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Real challenges from your branch and your chosen career — a fresh pick every week.
      </p>
      <div className="mt-4">
        <ArenaSubNav />
      </div>
      <div className="pt-6">
        <ArenaChallengesBoard />
      </div>
    </div>
  );
}
