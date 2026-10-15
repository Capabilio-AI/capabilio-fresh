import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Info, Lock } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { lessonFrom, loadLearning } from "@/lib/skillstudio/lesson";
import { courseHref, lessonHref, neighbours } from "@/lib/skillstudio/catalog";
import { STATUS_META } from "@/components/roadmap/visual/meta";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { LevelTrack } from "@/components/skillstudio/learn/LevelTrack";
import { LessonLearn } from "@/components/skillstudio/learn/LessonLearn";
import { LessonResources } from "@/components/skillstudio/learn/LessonResources";
import { LearningToggle } from "@/components/skillstudio/learn/LearningToggle";
import { StationLine } from "@/components/skillstudio/learn/StationLine";
import { courseColor } from "@/components/skillstudio/learn/palette";
import type { Link as Related } from "@/lib/roadmap-visual/explain-node";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Lesson — SkillStudio — Capabilio AI" };

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export default async function LessonPage({ params }: { params: Promise<{ module: string; topic: string }> }) {
  const p = await params;
  const { user } = await requireAuthedUser();
  const load = await loadLearning(createServiceClient(), user.id);
  if (!load.ok) redirect("/skillstudio");
  const lesson = lessonFrom(load, decode(p.module), decode(p.topic));
  if (!lesson) notFound();

  const { module: m, topic: t, explanation: e, courseOf } = lesson;
  const { prev, next } = neighbours(m, t.key);
  const meta = STATUS_META[e.status];
  const color = courseColor(m.key);
  const related = (items: Related[]) => items.filter((r) => courseOf[r.key]);

  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <LiveRefresh />
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-5 text-[13.5px] font-bold text-[var(--m-muted)]">
        <Link href="/skillstudio" className="hover:text-[var(--m-ink)]">Courses</Link>
        <span aria-hidden>/</span>
        <Link href={courseHref(m.key)} className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />{m.title}</Link>
      </nav>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_21rem]">
        <main id="lesson" className="flex min-w-0 flex-col gap-5">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-balance font-lp-display text-[32px] font-bold leading-[1.06] tracking-tight text-[var(--m-ink)] sm:text-[44px]">{t.title}</h1>
              <span className="rounded-full border border-[var(--m-ink)] px-3 py-1 text-[13px] font-bold text-[var(--m-ink)]">{meta.label}</span>
            </div>
            {e.description && <p className="mt-3 max-w-[64ch] text-[16px] leading-relaxed text-[var(--m-ink)]">{e.description}</p>}
            <p className="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-[var(--m-muted)]">{e.whyThisCareer}</p>
            <div className="mt-5 max-w-md"><LevelTrack level={t.level} target={t.target} /></div>
            {e.score && <p className="mt-3 max-w-[64ch] text-[14px] leading-relaxed text-[var(--m-muted)]">{e.score.summary}</p>}
          </header>

          {e.needsCheck && <p role="note" className="flex items-start gap-2 rounded-xl bg-[var(--app-warning-container)] px-4 py-3 text-[14px] text-[var(--m-ink)]"><Info size={16} aria-hidden className="mt-0.5 shrink-0" />{e.needsCheck}</p>}
          {e.status === "LOCKED" && (
            <p role="note" className="flex items-start gap-2 rounded-xl bg-[var(--m-ground)] px-4 py-3 text-[14px] text-[var(--m-ink)]"><Lock size={16} aria-hidden className="mt-0.5 shrink-0" />This lesson builds on an earlier one. You can still read ahead and ask the tutor.</p>
          )}

          <LessonLearn nodeKey={t.key} title={t.title} />
          <LessonResources e={e} />

          {(related(e.prerequisites).length > 0 || related(e.unlocks).length > 0) && (
            <section aria-labelledby="link-h" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
              <h2 id="link-h" className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Where it fits</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {([["Learn first", related(e.prerequisites)], ["Opens up", related(e.unlocks)]] as const).map(([title, items]) => items.length > 0 && (
                  <div key={title}>
                    <h3 className="mb-2 text-[14px] font-bold text-[var(--m-muted)]">{title}</h3>
                    <ul className="flex flex-wrap gap-2">
                      {items.map((r) => <li key={r.key}><Link href={lessonHref(courseOf[r.key], r.key)} className="inline-block rounded-full border border-[var(--m-rule)] px-3 py-1.5 text-[13.5px] font-bold text-[var(--m-ink)] hover:border-[var(--m-ink)]">{r.title}</Link></li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          <nav aria-label="Lesson navigation" className="grid gap-3 sm:grid-cols-2">
            {prev ? (
              <Link href={lessonHref(m.key, prev.key)} className="group flex items-center gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-4 hover:border-[var(--m-ink)]"><ArrowLeft size={16} aria-hidden className="shrink-0 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" /><span className="min-w-0"><span className="block text-[12.5px] text-[var(--m-muted)]">Previous</span><span className="block truncate text-[15px] font-bold text-[var(--m-ink)]">{prev.title}</span></span></Link>
            ) : <span />}
            {next ? (
              <Link href={lessonHref(m.key, next.key)} className="group flex items-center justify-between gap-3 rounded-2xl bg-[var(--m-ink)] p-4 text-white"><span className="min-w-0"><span className="block text-[12.5px] text-white/70">Next lesson</span><span className="block truncate text-[15px] font-bold">{next.title}</span></span><ArrowRight size={16} aria-hidden className="shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></Link>
            ) : (
              <Link href={courseHref(m.key)} className="group flex items-center justify-between gap-3 rounded-2xl bg-[var(--m-ink)] p-4 text-white"><span className="min-w-0"><span className="block text-[12.5px] text-white/70">That was the last lesson</span><span className="block truncate text-[15px] font-bold">Back to the course</span></span><ArrowRight size={16} aria-hidden className="shrink-0" /></Link>
            )}
          </nav>
        </main>

        <aside aria-label="This course" className="flex flex-col gap-4 lg:sticky lg:top-[140px] lg:h-fit">
          <LearningToggle nodeKey={t.key} careerId={lesson.careerId} initial={t.userState === "LEARNING"} />
          <div className="rounded-2xl border border-[var(--m-rule)] bg-white p-4">
            <h2 className="px-1 font-lp-display text-[17px] font-bold text-[var(--m-ink)]" style={{ color }}>{m.title}</h2>
            <div className="ss-scroll mt-2 max-h-[28rem] overflow-y-auto"><StationLine m={m} currentKey={t.key} /></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
