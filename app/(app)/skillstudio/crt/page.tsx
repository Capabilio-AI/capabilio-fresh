import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { AreaHero } from "@/components/metro/AreaHero";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";
import { CrtHome } from "@/components/crt/CrtHome";
import { loadStudentCrt } from "@/lib/crt/server";

export const metadata: Metadata = { title: "CRT | SkillStudio | Capabilio AI" };

export default async function CrtPage({ searchParams }: { searchParams: Promise<{ take?: string }> }) {
  const { user } = await requireAuthedUser();
  const { take } = await searchParams;
  const view = await loadStudentCrt(createServiceClient(), user.id);
  return (
    <div>
      <AreaHero tone="tint" title="CRT" intro="Campus recruitment training every six months: aptitude, reasoning, communication and soft skills, then an assessment your placement cell sees." nav={<SkillStudioSubNav />} />
      <div className="pt-6">
        <LiveRefresh />
        {view ? (
          <CrtHome cycles={view.cycles} sessions={view.sessions} autoStart={take && /^[0-9a-f-]{36}$/i.test(take) ? take : null} />
        ) : (
          <p className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center font-lp-body text-[13.5px] text-app-muted">Join your college on Capabilio to take part in its CRT cycles and training sessions.</p>
        )}
      </div>
    </div>
  );
}
