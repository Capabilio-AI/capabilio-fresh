import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { AreaHero } from "@/components/metro/AreaHero";
import { CourseProof } from "@/components/arena/CourseProof";
import { findTrack } from "@/lib/languages";
import { moduleStatuses } from "@/lib/languages/module-gate";
import { loadModuleProofs } from "@/lib/languages/module-proof";
import { loadProgress } from "@/lib/languages/progress";
import { challengeFor, finishStepIfReady, isStepOpen } from "@/lib/languages/step-proof";
import { allLessons } from "@/lib/languages/types";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Prove it | Arena | Capabilio AI" };

/** Where a course step is proven: the coding challenge on the Arena judge. Same rules as the lesson itself: a step that is not open yet cannot be proven. */
export default async function CourseProofPage({ params }: { params: Promise<{ track: string; lesson: string }> }) {
  const p = await params;
  const track = findTrack(p.track);
  if (!track) notFound();
  const current = allLessons(track).find((l) => l.key === p.lesson);
  if (!current) notFound();
  const unit = track.modules.find((m) => m.lessons.includes(current))!;
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const lessonHref = `/skillstudio/courses/${track.key}/${current.key}`;
  const [progress, proofs] = await Promise.all([loadProgress(service, user.id, track.key), loadModuleProofs(service, user.id, track.key)]);
  if (moduleStatuses(track, proofs)[track.modules.indexOf(unit)] === "locked" || !isStepOpen(unit, current.key, progress)) redirect(lessonHref);

  const challenge = await challengeFor(service, user.id, track.key, current.key);
  if (!challenge.hasChallenge) redirect(lessonHref);
  const step = await finishStepIfReady(service, user.id, track, current.key, challenge);
  const nextInModule = unit.lessons[unit.lessons.indexOf(current) + 1] ?? null;
  const onward = nextInModule
    ? { href: `/skillstudio/courses/${track.key}/${nextInModule.key}`, label: `Next: ${nextInModule.title}` }
    : { href: `/skillstudio/courses/${track.key}/module/${unit.key}`, label: `Take the ${unit.title} test` };

  return (
    <div className="ss-studio flex flex-col gap-6">
      <AreaHero
        tone="dark" title="Prove it in Arena" intro={`${track.title}: ${current.title}. Pass the coding challenge on the Arena judge and this step becomes a proven skill.`}
        nav={(
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-bold text-white/70">
            <Link href={`/skillstudio/courses/${track.key}`} className="hover:text-white">{track.title}</Link><span aria-hidden>/</span>
            <Link href={lessonHref} className="inline-flex items-center gap-1.5 hover:text-white"><ArrowLeft size={13} aria-hidden />{current.title}</Link>
          </nav>
        )}
      />
      <CourseProof track={track.key} lessonKey={current.key} initialStep={step} lessonHref={lessonHref} onward={onward} />
    </div>
  );
}
