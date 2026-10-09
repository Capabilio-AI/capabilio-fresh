import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getStudentDirection } from "@/lib/career/direction";
import { loadStudyMaterials } from "@/lib/skillstudio/materials";
import { AreaHero } from "@/components/metro/AreaHero";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { MaterialsBoard } from "@/components/skillstudio/MaterialsBoard";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";

export const metadata: Metadata = { title: "Materials | SkillStudio | Capabilio AI" };

export default async function MaterialsPage() {
  const { supabase, user } = await requireAuthedUser();
  const service = createServiceClient();
  const direction = await getStudentDirection(service, user.id);
  const view = await loadStudyMaterials(supabase, service, user.id, direction?.academicYear?.year ?? null);
  return (
    <div>
      <AreaHero tone="tint" title="Materials" intro="Notes, PDFs and links your professors and mentors share with you." nav={<SkillStudioSubNav />} />
      <div className="pt-6">
        <LiveRefresh />
        {view ? <MaterialsBoard view={view} /> : (
          <p className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center font-lp-body text-[13.5px] text-app-muted">Join your college on Capabilio to see the materials your faculty share with your branch.</p>
        )}
      </div>
    </div>
  );
}
