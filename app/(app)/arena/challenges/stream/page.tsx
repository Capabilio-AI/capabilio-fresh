import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { TrackChallengesBoard } from "@/components/arena/TrackChallengesBoard";

export const metadata: Metadata = {
  title: "Stream Challenges — Arena — Capabilio AI",
  description: "Weekly challenges from your branch curriculum — own leaderboard, streak, and history.",
};

export default async function StreamChallengesPage() {
  await requireAuthedUser();

  return (
    <div>
      <Link href="/arena/challenges" className="inline-flex items-center gap-1.5 font-lp-body text-[13px] text-app-muted hover:text-[var(--m-ink)]">
        <ArrowLeft size={14} />
        Challenges
      </Link>
      <h1 className="mt-2 font-lp-display text-[26px] font-bold text-[var(--m-ink)]">Stream Challenges</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">A fresh batch of 8 every Monday, from your own branch curriculum.</p>
      <div className="pt-6">
        <TrackChallengesBoard track="stream" />
      </div>
    </div>
  );
}
