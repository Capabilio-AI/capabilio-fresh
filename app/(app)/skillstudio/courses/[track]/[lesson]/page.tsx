import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { LearningPath } from "@/components/languages/studio/LearningPath";
import { LessonStudio } from "@/components/languages/studio/LessonStudio";
import type { PathModule, RecordedAnswer } from "@/components/languages/studio/types";
import type { StudioExample } from "@/components/languages/studio/ConceptPanel";
import { findTrack } from "@/lib/languages";
import { ANALOGIES } from "@/lib/languages/analogies";
import { canGuess } from "@/lib/languages/guess";
import { gradeLessonCheck, publicLesson } from "@/lib/languages/lesson-check";
import { moduleStatuses } from "@/lib/languages/module-gate";
import { loadModuleProofs } from "@/lib/languages/module-proof";
import { exampleLanguage } from "@/lib/languages/playground-language";
import { loadProgress, trackProgress } from "@/lib/languages/progress";
import { challengeFor, finishStepIfReady, firstOpenStep, isStepOpen, loadAnswers } from "@/lib/languages/step-proof";
import { allLessons } from "@/lib/languages/types";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Lesson | SkillStudio | Capabilio AI" };

/** The short mark shown for each language; plain letters, not a logo. */
const MARK: Record<string, string> = { c: "C", java: "Jv", python: "Py", cpp: "C++", sql: "SQL", html: "</>", javascript: "JS", csharp: "C#" };

/**
 * A lesson as a studio: the learning path on the left, the idea with an everyday analogy in the middle, and Predict / Build / Prove on the right. A step opens only
 * when the steps before it in its module are complete, and a step is complete only when the SERVER has recorded every answer and the coding challenge pass.
 */
export default async function LanguageLessonPage({ params }: { params: Promise<{ track: string; lesson: string }> }) {
  const p = await params;
  const track = findTrack(p.track);
  if (!track) notFound();
  const lessons = allLessons(track);
  const index = lessons.findIndex((l) => l.key === p.lesson);
  if (index === -1) notFound();
  const current = lessons[index];
  const unit = track.modules.find((m) => m.lessons.includes(current))!;
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const [progress, proofs] = await Promise.all([loadProgress(service, user.id, track.key), loadModuleProofs(service, user.id, track.key)]);
  const statuses = moduleStatuses(track, proofs);
  // a lesson of a module that is not open yet cannot be read: prove the module before it first
  if (statuses[track.modules.indexOf(unit)] === "locked") redirect(`/skillstudio/courses/${track.key}?locked=${unit.key}`);
  // a step opens only after the steps before it in its module are complete
  if (!isStepOpen(unit, current.key, progress)) redirect(`/skillstudio/courses/${track.key}/${firstOpenStep(unit, progress)}`);

  // where this step stands, decided from what the server recorded; a step that is ready to close is closed here
  const [answers, challenge] = await Promise.all([loadAnswers(service, user.id, track.key, current.key), challengeFor(service, user.id, track.key, current.key)]);
  const step = await finishStepIfReady(service, user.id, track, current.key, challenge);
  const done = step.complete && !progress[current.key] ? { ...progress, [current.key]: { correct: step.correct, total: step.total, completedAt: new Date().toISOString() } } : progress;
  const initialAnswers: Record<number, RecordedAnswer> = Object.fromEntries(Object.entries(answers).flatMap(([i, choice]) => {
    const v = gradeLessonCheck(track, current.key, Number(i), choice);
    return v ? [[Number(i), { choice, correct: v.correct, answerIndex: v.answerIndex, why: v.why }]] : [];
  }));

  const examples: StudioExample[] = current.lesson.sections.flatMap((s) => {
    if (!s.example?.code) return [];
    const language = exampleLanguage(track.key, s.example.code);
    return [{ title: s.example.title, code: s.example.code, explanation: s.example.explanation, language, guessable: canGuess(language, s.example.code) }];
  });

  const path: PathModule[] = track.modules.map((m, mi) => ({
    key: m.key, title: m.title, status: statuses[mi], current: m === unit,
    testReady: m.lessons.every((l) => done[l.key]),
    lessons: m.lessons.map((l) => ({ key: l.key, title: l.title, state: statuses[mi] === "locked" ? "locked" : l === current ? "current" : done[l.key] ? "done" : isStepOpen(m, l.key, done) ? "open" : "locked" })),
  }));
  const tally = trackProgress(track, done);
  const at = unit.lessons.indexOf(current);
  const nextInModule = unit.lessons[at + 1] ?? null;

  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <div className="mx-auto w-full max-w-[1480px]">
        <header className="flex flex-wrap items-end justify-between gap-4 pt-6">
          <div>
            <p className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-[var(--m-muted)]">SkillStudio</p>
            <h1 className="font-lp-display text-[36px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[44px]">Your skill journey</h1>
            <p className="mt-1 text-[16px] text-[var(--m-muted)]">Learn it. Build it. Prove it.</p>
          </div>
          <Link href={`/skillstudio/courses/${track.key}`} className="flex min-w-[260px] items-center gap-4 rounded-2xl border border-[var(--m-rule)] bg-white px-4 py-3">
            <span className="min-w-0"><span className="block text-[13px] font-bold text-[var(--m-muted)]">Course</span><span className="block font-lp-display text-[18px] font-bold leading-tight text-[var(--m-ink)]">{track.title}</span></span>
            <span className="min-w-[120px] flex-1"><span className="ss-num block text-[12.5px] font-bold text-[var(--m-ink)]">{tally.pct}% ({tally.done}/{tally.total} lessons)</span><span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${tally.pct} percent of the course done`}><span className="block h-full rounded-full bg-[#17784a]" style={{ width: `${tally.pct}%` }} /></span></span>
          </Link>
        </header>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-4 text-[13.5px] font-bold text-[var(--m-muted)]">
          <Link href="/skillstudio/courses" className="hover:text-[var(--m-ink)]">Courses</Link><span aria-hidden>/</span>
          <Link href={`/skillstudio/courses/${track.key}`} className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />{track.title}</Link><span aria-hidden>/</span>
          <span className="text-[var(--m-ink)]">{current.title}</span>
        </nav>
        <div className="mt-4 grid items-start gap-5 pb-12 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <LearningPath trackKey={track.key} title={track.title} tagline={track.tagline} mark={MARK[track.key] ?? track.title.slice(0, 2)} done={tally.done} total={tally.total} pct={tally.pct} modules={path} />
          <LessonStudio
            key={current.key} track={track.key} lessonKey={current.key} title={current.title} minutes={current.minutes} lesson={publicLesson(current.lesson)}
            analogy={ANALOGIES[`${track.key}/${current.key}`] ?? null} examples={examples} initialStep={step} initialAnswers={initialAnswers}
            next={nextInModule ? { href: `/skillstudio/courses/${track.key}/${nextInModule.key}`, title: nextInModule.title } : null}
            moduleTest={nextInModule ? null : { href: `/skillstudio/courses/${track.key}/module/${unit.key}`, moduleTitle: unit.title }}
          />
        </div>
      </div>
    </div>
  );
}
