import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { LessonWorkspace } from "@/components/languages/LessonWorkspace";
import { LessonSidebar } from "@/components/languages/LessonSidebar";
import { ModuleSegments } from "@/components/languages/ModuleSegments";
import { findTrack } from "@/lib/languages";
import { publicLesson } from "@/lib/languages/lesson-check";
import { loadProgress } from "@/lib/languages/progress";
import { loadModuleProofs } from "@/lib/languages/module-proof";
import { moduleStatuses } from "@/lib/languages/module-gate";
import { allLessons } from "@/lib/languages/types";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Lesson | SkillStudio | Capabilio AI" };

export default async function LanguageLessonPage({ params }: { params: Promise<{ track: string; lesson: string }> }) {
  const p = await params;
  const track = findTrack(p.track);
  if (!track) notFound();
  const lessons = allLessons(track);
  const index = lessons.findIndex((l) => l.key === p.lesson);
  if (index === -1) notFound();
  const current = lessons[index];
  const unit = track.modules.find((m) => m.lessons.includes(current))!;
  const prev = lessons[index - 1] ?? null;
  const next = lessons[index + 1] ?? null;
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const [progress, proofs] = await Promise.all([loadProgress(service, user.id, track.key), loadModuleProofs(service, user.id, track.key)]);
  // a lesson of a module that is not open yet cannot be read: prove the module before it first
  if (moduleStatuses(track, proofs)[track.modules.indexOf(unit)] === "locked") redirect(`/skillstudio/courses/${track.key}?locked=${unit.key}`);
  const href = (k: string) => `/skillstudio/courses/${track.key}/${k}`;
  const isLastInModule = unit.lessons[unit.lessons.length - 1] === current;
  const moduleTest = isLastInModule ? { href: `/skillstudio/courses/${track.key}/module/${unit.key}`, moduleTitle: unit.title, othersDone: unit.lessons.filter((l) => l !== current).every((l) => progress[l.key]) } : null;

  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <div className="mx-auto w-full max-w-[1320px]">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-5 text-[13.5px] font-bold text-[var(--m-muted)]">
        <Link href="/skillstudio/courses" className="hover:text-[var(--m-ink)]">Courses</Link>
        <span aria-hidden>/</span>
        <Link href={`/skillstudio/courses/${track.key}`} className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />{track.title}</Link>
      </nav>
      <div className="mt-4 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <LessonSidebar track={track} current={current.key} done={progress} locked={moduleStatuses(track, proofs)} />
        <main className="flex min-w-0 flex-col gap-5">
          <header>
            <ModuleSegments track={track.key} moduleTitle={unit.title} lessons={unit.lessons.map((l) => ({ key: l.key, title: l.title }))} done={progress} current={current.key} minutes={current.minutes} />
            <h1 className="mt-4 text-balance font-lp-display text-[32px] font-bold leading-[1.06] tracking-tight text-[var(--m-ink)] sm:text-[40px]">{current.title}</h1>
          </header>
          <LessonWorkspace track={track.key} trackTitle={track.title} lessonKey={current.key} lesson={publicLesson(current.lesson)} alreadyDone={Boolean(progress[current.key])}
            prev={prev ? { href: href(prev.key), title: prev.title } : null} next={next ? { href: href(next.key), title: next.title } : null} moduleTest={moduleTest} />
        </main>
      </div>
      </div>
    </div>
  );
}
