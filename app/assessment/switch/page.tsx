import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { RoleSwitchFlow } from "@/components/assess/steps/RoleSwitchFlow";
import { getCareerProfile } from "@/lib/assess/career-profile";
import { loadRoleOptions } from "@/lib/assess/roles";
import { planAInsights } from "@/lib/careers/plan-a-insights";
import { isPlanBOpen } from "@/lib/careers/plan-b";
import type { Db } from "@/lib/assess/db";

export const metadata: Metadata = {
  title: "Change career role — Capabilio AI",
  description: "Review your current role, then take the assessment for your new one.",
};

/** Plan B "Change career role": 3rd year onward, and only for a student who has a main role to leave. */
export default async function RoleSwitchPage() {
  const { user } = await requireAuthedUser();
  const db = createServiceClient() as unknown as Db;
  if (!(await isPlanBOpen(createServiceClient(), user.id))) redirect("/dashboard");
  const [profile, roles] = await Promise.all([getCareerProfile(db, user.id), loadRoleOptions(db)]);
  const insights = planAInsights(profile);
  if (!insights) redirect("/dashboard/roadmap");
  // the role being left is not a choice
  return <RoleSwitchFlow roles={roles.filter((r) => r.careerId !== profile.role?.id)} insights={insights} />;
}
