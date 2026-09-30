import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { TrackChallengesBoard } from "@/components/arena/TrackChallengesBoard";

export const metadata: Metadata = {
  title: "Domain Challenges — Arena — Capabilio AI",
  description: "Work tickets for your chosen career role — own leaderboard, streak, and history.",
};

export default async function DomainChallengesPage() {
  await requireAuthedUser();

  return (
    <div>
      <Link href="/arena/challenges" className="inline-flex items-center gap-1.5 font-lp-body text-[13px] text-app-muted hover:text-app-charcoal">
        <ArrowLeft size={14} />
        Challenges
      </Link>
      <h1 className="mt-2 font-lp-display text-[26px] font-semibold text-app-charcoal">Domain Challenges</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Work tickets for your chosen career role, verified against a real dataset.</p>
      <div className="pt-6">
        <TrackChallengesBoard track="domain" />
      </div>
    </div>
  );
}
