import type { Metadata } from "next";
import Link from "next/link";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { requireStage } from "@/lib/stage/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { studentGate } from "@/lib/assess/gate";
import type { Db } from "@/lib/assess/db";
import { OnboardingGate } from "@/components/assess/OnboardingGate";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { JobPack } from "@/components/roadmap/visual/JobPack";

export const metadata: Metadata = { title: "Job pack — Capabilio AI" };

export default async function JobPackPage({ searchParams }: { searchParams: Promise<{ career?: string }> }) {
  await requireStage(["student"]);
  const { user } = await requireAuthedUser();
  const gate = await studentGate(createServiceClient() as unknown as Db, user.id);
  if (gate.locked && gate.status) return <OnboardingGate status={gate.status} feature="your job pack" />;
  const career = (await searchParams).career === "plan-b" ? "plan-b" : "primary";
  return (
    <div>
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Job pack</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">What employers are asking for, who is hiring and what it pays, openings you can aim at, and how to prepare. <Link href={`/dashboard/roadmap${career === "plan-b" ? "?career=plan-b" : ""}`} className="font-semibold text-app-blue hover:underline">Back to your roadmap</Link></p>
      <div className="mt-4"><DashboardSubNav /></div>
      <div className="pt-4"><JobPack career={career} /></div>
    </div>
  );
}
