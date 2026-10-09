import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getCareerProfile } from "@/lib/assess/career-profile";
import { ProfileEloCard, ProfileSkillGraph, ProfileSkills } from "@/components/assess/result/ProfileViews";
import type { Db } from "@/lib/assess/db";

export const metadata: Metadata = { title: "Your results — Capabilio AI" };

export default async function ResultsPage() {
  const { user } = await requireAuthedUser();
  const profile = await getCareerProfile(createServiceClient() as unknown as Db, user.id);
  if (!profile.unlocked || !profile.elo) redirect("/assessment");
  // server-read once, handed to every view: the page, the card and the graph show the same object
  return (
    <div className="space-y-5">
      <h1 className="font-lp-display text-[34px] font-bold leading-tight text-[var(--m-ink)]">Your results</h1>
      <ProfileEloCard initial={profile} />
      <ProfileSkillGraph initial={profile} />
      <ProfileSkills initial={profile} />
    </div>
  );
}
