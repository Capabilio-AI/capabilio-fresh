import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { matchCareersForStudent } from "@/lib/career/match";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { SkillGapsTab } from "@/components/dashboard/SkillGapsTab";

export const metadata: Metadata = { title: "Skill Gap — Capabilio AI" };

export default async function SkillGapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const careerMatches = await matchCareersForStudent(supabase, user.id);

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Skill Gap</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        What each career target needs, compared with where you are today.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>
      <div className="pt-6">
        <SkillGapsTab matches={careerMatches} />
      </div>
    </div>
  );
}
