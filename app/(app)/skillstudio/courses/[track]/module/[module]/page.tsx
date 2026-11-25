import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { ModuleTest } from "@/components/languages/ModuleTest";
import { findTrack } from "@/lib/languages";
import { loadModuleProofs } from "@/lib/languages/module-proof";
import { loadExamLevels } from "@/lib/languages/year-exam";
import { moduleStatuses } from "@/lib/languages/module-gate";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Module test | SkillStudio | Capabilio AI" };

/** The test that proves a module. A locked module redirects to the track; an unfinished one says which lessons are left (the API enforces both). */
export default async function ModuleTestPage({ params }: { params: Promise<{ track: string; module: string }> }) {
  const p = await params;
  const track = findTrack(p.track);
  const index = track ? track.modules.findIndex((m) => m.key === p.module) : -1;
  if (!track || index === -1) notFound();
  const m = track.modules[index];
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const proofs = await loadModuleProofs(service, user.id, track.key);
  if (moduleStatuses(track, proofs, await loadExamLevels(service, user.id, track.key))[index] === "locked") redirect(`/skillstudio/courses/${track.key}?locked=${m.key}`);
  const nextModule = track.modules[index + 1];
  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <div className="mx-auto w-full max-w-[1100px] pb-16">
        <nav aria-label="Breadcrumb" className="pt-5 text-[13.5px] font-bold text-[var(--m-muted)]">
          <Link href={`/skillstudio/courses/${track.key}`} className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />{track.title}</Link>
        </nav>
        <header className="mb-6 mt-4">
          <p className="text-[13.5px] font-bold text-[var(--m-muted)]">Module {index + 1} of {track.modules.length}</p>
          <h1 className="mt-1 font-lp-display text-[32px] font-bold leading-[1.06] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Prove: {m.title}</h1>
          <p className="mt-2 max-w-[62ch] text-[15.5px] leading-relaxed text-[var(--m-muted)]">Pass the assessment{m.challenge ? " and solve the problem" : ""} to prove this module{nextModule ? " and open the next one" : ""}.</p>
        </header>
        <ModuleTest track={track.key} module={m.key} nextHref={nextModule ? `/skillstudio/courses/${track.key}/${nextModule.lessons[0].key}` : `/skillstudio/courses/${track.key}`} nextLabel={nextModule ? `Start: ${nextModule.title}` : "Back to the course"} finalModule={nextModule ? undefined : { courseTitle: track.title }} />
      </div>
    </div>
  );
}
