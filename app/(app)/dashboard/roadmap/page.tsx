import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getRoadmapGraph } from "@/lib/roadmap-visual/service";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { RoadmapExperience } from "@/components/roadmap/visual/RoadmapExperience";

export const metadata: Metadata = { title: "Roadmap — Capabilio AI" };

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ career?: string; tab?: string; version?: string }> }) {
  const { user } = await requireAuthedUser();
  const sp = await searchParams;
  if (sp.tab || sp.version) redirect("/dashboard/roadmap"); // the old plan view is folded into the one map
  const career = sp.career === "plan-b" ? "plan-b" : "primary";
  const initial = await getRoadmapGraph(createServiceClient(), user.id, career);
  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Roadmap</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your target career, your college syllabus and your verified skills on one map. It updates as any of them change.</p>
      <div className="mt-4"><DashboardSubNav /></div>
      <div className="pt-4"><RoadmapExperience initial={initial} initialCareer={career} /></div>
    </div>
  );
}
