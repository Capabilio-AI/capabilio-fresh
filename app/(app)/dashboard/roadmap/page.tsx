import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadRoadmapForStudent } from "@/lib/roadmap/load";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { RoadmapView } from "@/components/roadmap/RoadmapView";

export const metadata: Metadata = { title: "Roadmap — Capabilio AI" };

export default async function RoadmapPage() {
  const { supabase, user } = await requireAuthedUser();
  const result = await loadRoadmapForStudent(supabase, createServiceClient(), user.id);
  // Job-track only: for anyone else this route simply does not exist.
  if (!result.applicable) notFound();

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Roadmap</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Where your college curriculum and your verified Arena work line up — and what&rsquo;s still missing for your target role.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>
      <div className="pt-6">
        <RoadmapView roadmap={result.roadmap} />
      </div>
    </div>
  );
}
