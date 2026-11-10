import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { AreaHero, HeroStat } from "@/components/metro/AreaHero";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";
import { CrtHome } from "@/components/crt/CrtHome";
import { loadStudentCrt } from "@/lib/crt/server";
import { loadStudio } from "@/lib/crt/studio-server";

export const metadata: Metadata = { title: "CRT | SkillStudio | Capabilio AI" };

export default async function CrtPage({ searchParams }: { searchParams: Promise<{ take?: string }> }) {
  const { user } = await requireAuthedUser();
  const { take } = await searchParams;
  const service = createServiceClient();
  const base = await loadStudentCrt(service, user.id);
  const view = base ? await loadStudio(service, user.id, base.cycles) : null;
  const tone = "tint" as const;
  return (
    <div>
      <AreaHero
        tone={tone}
        title="Your Career Studio"
        intro="Build confidence. Develop skills. Get career-ready."
        aside={view && (
          <>
            <HeroStat tone={tone} value={view.stats.answered} label="Questions answered" />
            <HeroStat tone={tone} value={view.stats.accuracyPct !== null ? `${view.stats.accuracyPct}%` : "–"} label="Accuracy" />
            <HeroStat tone={tone} value={view.stats.hours > 0 ? `~${view.stats.hours} h` : "0 h"} label="Time practised" />
            <HeroStat tone={tone} value={view.stats.streak} label="Day streak" />
          </>
        )}
        nav={<SkillStudioSubNav />}
      />
      <div className="pt-6">
        <LiveRefresh />
        {base && view ? (
          <CrtHome cycles={base.cycles} view={view} autoStart={take && /^[0-9a-f-]{36}$/i.test(take) ? take : null} />
        ) : (
          <p className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center font-lp-body text-[13.5px] text-app-muted">Join your college on Capabilio to take part in its CRT cycles and training sessions.</p>
        )}
      </div>
    </div>
  );
}
