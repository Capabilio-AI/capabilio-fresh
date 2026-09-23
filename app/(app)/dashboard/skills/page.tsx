import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getSkills } from "@/lib/dashboard/data";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { SkillsTab } from "@/components/dashboard/SkillsTab";

export const metadata: Metadata = { title: "Skills — Capabilio AI" };

export default async function SkillsPage() {
  const { supabase, user } = await requireAuthedUser();

  const skills = await getSkills(supabase, user.id);

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Skills</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your capability by skill, grouped by domain.</p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>
      <div className="pt-6">
        <SkillsTab skills={skills} />
      </div>
    </div>
  );
}
