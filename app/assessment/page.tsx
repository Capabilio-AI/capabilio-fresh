import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AssessFlow } from "@/components/assess/AssessFlow";
import { getFlowSnapshot } from "@/lib/assess/flow";
import type { Db } from "@/lib/assess/db";

export const metadata: Metadata = {
  title: "Assessment — Capabilio AI",
  description: "Choose your career, then complete your general and career assessments.",
};

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ plan?: string; retake?: string; step?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const sp = await searchParams;
  const snapshot = await getFlowSnapshot(createServiceClient() as unknown as Db, userId, { plan: sp.plan === "b" ? "b" : null, retake: sp.retake === "1", changeRole: sp.step === "role" });
  // students who finished (or were grandfathered) go straight to the app; the page only stays for a deliberate retake / Plan B
  if (snapshot.stage === "done" && snapshot.hasCareerResult) redirect("/dashboard");
  return <AssessFlow snapshot={snapshot} />;
}
