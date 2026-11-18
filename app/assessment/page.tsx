import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { AssessFlow } from "@/components/assess/AssessFlow";
import { getFlowSnapshot } from "@/lib/assess/flow";
import { getStageState } from "@/lib/stage/server";
import type { Db } from "@/lib/assess/db";

export const metadata: Metadata = {
  title: "Assessment — Capabilio AI",
  description: "Choose your career, then complete your general and career assessments.",
};

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ plan?: string; retake?: string; step?: string; role?: string }> }) {
  const { user } = await requireAuthedUser();
  const userId = user.id;

  const sp = await searchParams;
  // Professionals are verified through EPFO and are not assessed: login lands every student-kind account here, so they are sent on to their own dashboard.
  if ((await getStageState(userId)).stage === "professional") redirect("/dashboard");
  const snapshot = await getFlowSnapshot(createServiceClient() as unknown as Db, userId, { plan: sp.plan === "b" ? "b" : null, retake: sp.retake === "1", changeRole: sp.step === "role" });
  // Students who are finished go straight to the app, whether or not they have a role result yet (a 1st or 2nd year who skipped or deferred the role
  // has none): the page only stays for a deliberate retake, Plan B or role change. The optional role assessment is offered from the dashboard profile.
  const deliberate = sp.retake === "1" || sp.plan === "b" || sp.step === "role";
  if (snapshot.stage === "done" && (snapshot.hasCareerResult || !deliberate)) redirect("/dashboard");
  return <AssessFlow snapshot={snapshot} initialRole={sp.role?.slice(0, 80)} />;
}
