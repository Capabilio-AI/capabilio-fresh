import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStage } from "@/lib/stage/guard";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadStreamGate } from "@/lib/arena-challenges/stream-gate";
import { STREAM_FIRST_YEAR } from "@/lib/career/term";
import { TrackChallengesBoard } from "@/components/arena/TrackChallengesBoard";

export const metadata: Metadata = {
  title: "Stream Challenges — Arena — Capabilio AI",
  description: "Weekly challenges from your branch curriculum — own leaderboard, streak, and history.",
};

export default async function StreamChallengesPage() {
  await requireStage(["student"]); // stream challenges come from a study programme
  const { user } = await requireAuthedUser();
  const gate = await loadStreamGate(createServiceClient(), user.id);

  return (
    <div>
      <Link href="/arena/challenges" className="inline-flex items-center gap-1.5 font-lp-body text-[13px] text-app-muted hover:text-[var(--m-ink)]">
        <ArrowLeft size={14} />
        Challenges
      </Link>
      <h1 className="mt-2 font-lp-display text-[26px] font-bold text-[var(--m-ink)]">Stream Challenges</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Spin the wheel every Sunday at 12:00 AM to get 4 to 9 fresh challenges from your own branch curriculum.</p>
      <div className="pt-6">
        {gate.open ? (
          <TrackChallengesBoard track="stream" />
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--m-rule)] bg-white px-6 py-12 text-center">
            <p className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">Stream challenges open in year {STREAM_FIRST_YEAR}</p>
            <p className="mx-auto mt-1 max-w-md font-lp-body text-[13px] text-app-muted">Until then, follow your roadmap, learn in SkillStudio, and build projects of your own or ones your staff assign.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              <Link href="/dashboard/roadmap" className="font-lp-body text-[13px] font-semibold text-app-orange hover:underline">Open your roadmap</Link>
              <Link href="/skillstudio" className="font-lp-body text-[13px] font-semibold text-app-orange hover:underline">Go to SkillStudio</Link>
              <Link href="/arena/projects" className="font-lp-body text-[13px] font-semibold text-app-orange hover:underline">Projects</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
