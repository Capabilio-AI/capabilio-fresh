import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { RoleLessonView } from "@/components/skillstudio/RoleLessonView";
import { findRoleLesson, lessonsOfRole } from "@/lib/role-lessons";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Lesson | Job path | SkillStudio | Capabilio AI" };

/** A hand-written lesson of a job's path. Its examples run in the learner's browser, with the output of a real run shown beside them. */
export default async function RoleLessonPage({ params }: { params: Promise<{ key: string; lesson: string }> }) {
  await requireAuthedUser();
  const { key, lesson: lessonKey } = await params;
  const lesson = findRoleLesson(key, lessonKey);
  if (!lesson) notFound();
  const all = lessonsOfRole(key);
  const at = all.findIndex((l) => l.key === lesson.key);
  const next = all[at + 1] ?? null;
  const path = `/skillstudio/courses/role/${key}`;
  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <nav aria-label="Breadcrumb" className="pt-5 text-[13.5px] font-bold text-[var(--m-muted)]">
        <Link href={path} className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />Job path</Link>
      </nav>
      <header className="mt-4 max-w-[62ch]">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-[var(--m-muted)]">Lesson {at + 1} of {all.length} · {lesson.minutes} min</p>
        <h1 className="font-lp-display text-[32px] font-bold leading-[1.06] tracking-tight text-[var(--m-ink)] sm:text-[42px]">{lesson.title}</h1>
      </header>
      <div className="mt-6 pb-12">
        <RoleLessonView lesson={lesson} next={next ? { href: `${path}/learn/${next.key}`, title: next.title } : null} proveHref="/arena/challenges/domain" />
      </div>
    </div>
  );
}
