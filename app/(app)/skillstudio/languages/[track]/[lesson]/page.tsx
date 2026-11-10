import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { LanguageLesson } from "@/components/languages/LanguageLesson";
import { findTrack } from "@/lib/languages";
import { loadProgress } from "@/lib/languages/progress";
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
  const next = lessons[index + 1] ?? null;
  const { user } = await requireAuthedUser();
  const progress = await loadProgress(createServiceClient(), user.id, track.key);

  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <div className="mx-auto w-full max-w-[78ch]">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-5 text-[13.5px] font-bold text-[var(--m-muted)]">
        <Link href="/skillstudio/languages" className="hover:text-[var(--m-ink)]">Languages</Link>
        <span aria-hidden>/</span>
        <Link href={`/skillstudio/languages/${track.key}`} className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />{track.title}</Link>
      </nav>
      <main className="mt-4 flex flex-col gap-5">
        <header>
          <p className="text-[13.5px] font-bold text-[var(--m-muted)]">{unit.title} · {current.minutes} min</p>
          <h1 className="mt-1 text-balance font-lp-display text-[32px] font-bold leading-[1.06] tracking-tight text-[var(--m-ink)] sm:text-[44px]">{current.title}</h1>
        </header>
        <LanguageLesson track={track.key} lessonKey={current.key} lesson={current.lesson} alreadyDone={Boolean(progress[current.key])} />
        {next && (
          <Link href={`/skillstudio/languages/${track.key}/${next.key}`} className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white">
            Next: {next.title}<ArrowRight size={15} aria-hidden />
          </Link>
        )}
      </main>
      </div>
    </div>
  );
}
