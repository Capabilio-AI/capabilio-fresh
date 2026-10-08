import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getRoadmapGraph } from "@/lib/roadmap-visual/service";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { getStudentDirection } from "@/lib/career/direction";
import { getCareerIntent } from "@/lib/careers/intent";
import { PLAN_B_LABEL } from "@/lib/careers/plan-b-labels";
import { PlanBDialog } from "@/components/direction/PlanBDialog";
import { RoadmapExperience } from "@/components/roadmap/visual/RoadmapExperience";

export const metadata: Metadata = { title: "Roadmap — Capabilio AI" };

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ career?: string; tab?: string; version?: string }> }) {
  const { user } = await requireAuthedUser();
  const sp = await searchParams;
  if (sp.tab || sp.version) redirect("/dashboard/roadmap"); // the old plan view is folded into the one map
  const career = sp.career === "plan-b" ? "plan-b" : "primary";
  const service = createServiceClient();
  const [initial, direction, planB] = await Promise.all([getRoadmapGraph(createServiceClient(), user.id, career), getStudentDirection(service, user.id), getCareerIntent(service, user.id)]);
  // Plan B: a button during 3-1 (until a real choice is saved), and the saved answer afterwards.
  const canChoose = Boolean(direction?.planBOpen) && (!planB.intent.planBKind || planB.intent.planBKind === "undecided");
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Roadmap</h1>
        {canChoose && (
          <PlanBDialog autoOpen={!planB.intent.planBKind} mainCareer={planB.intent.primary?.name ?? null} careers={planB.careers.filter((c) => c.id !== planB.intent.primary?.id)} triggerLabel={planB.intent.planBKind ? "Decide Plan B" : "Plan B"} />
        )}
        {!canChoose && planB.intent.planBKind && (
          <p className="rounded-full border border-app-border bg-white px-3 py-1 font-lp-body text-[12.5px] text-app-charcoal">Plan B: {PLAN_B_LABEL[planB.intent.planBKind]}</p>
        )}
      </div>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your target career, your college syllabus and your verified skills on one map. It updates as any of them change.</p>
      <div className="mt-4"><DashboardSubNav /></div>
      <div className="pt-4"><RoadmapExperience initial={initial} initialCareer={career} /></div>
    </div>
  );
}
