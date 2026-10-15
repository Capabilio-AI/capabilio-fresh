import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, FolderKanban, Swords, Award } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadLearning } from "@/lib/skillstudio/lesson";
import { courseState, courseStats, lessonHref } from "@/lib/skillstudio/catalog";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { StationLine } from "@/components/skillstudio/learn/StationLine";
import { SegmentBar } from "@/components/skillstudio/learn/SegmentBar";
import { courseColor, STAGE_NAME } from "@/components/skillstudio/learn/palette";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Course — SkillStudio — Capabilio AI" };

export default async function CoursePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: raw } = await params;
  const { user } = await requireAuthedUser();
  const load = await loadLearning(createServiceClient(), user.id);
  if (!load.ok) redirect("/skillstudio");
  const key = decodeURIComponent(raw);
  const m = load.view.modules.find((x) => x.key === key);
  if (!m) notFound();

  const color = courseColor(m.key);
  const stats = courseStats(m);
  const state = courseState(m);
  const resume = m.topics.find((t) => t.userState === "LEARNING") ?? m.topics.find((t) => t.status !== "TARGET_MET" && t.status !== "SKIPPED" && t.status !== "LOCKED");
  const practice = [
    { icon: BookOpen, n: m.practice.learning, label: "learning resources" },
    { icon: Swords, n: m.practice.arena, label: "Arena challenges" },
    { icon: FolderKanban, n: m.practice.projects, label: "projects" },
    { icon: Award, n: m.practice.certifications, label: "certifications" },
  ].filter((p) => p.n > 0);

  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <LiveRefresh />
      <nav aria-label="Breadcrumb" className="pt-5">
        <Link href="/skillstudio" className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--m-muted)] hover:text-[var(--m-ink)]"><ArrowLeft size={14} aria-hidden />All courses</Link>
      </nav>

      <header className="mt-3 overflow-hidden rounded-3xl p-6 text-white sm:p-8" style={{ background: color }}>
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
          <span className="rounded-full bg-black/20 px-3 py-1">{STAGE_NAME[m.stage]}</span>
          {m.focus && <span className="rounded-full bg-white px-3 py-1" style={{ color }}>Learn now</span>}
        </div>
        <h1 className="mt-3 text-balance font-lp-display text-[34px] font-bold leading-[1.05] tracking-tight sm:text-[48px]">{m.title}</h1>
        {m.description && <p className="mt-3 max-w-[60ch] text-[15.5px] leading-relaxed text-white/85">{m.description}</p>}
        <div className="mt-6 max-w-md">
          <div className="rounded-full bg-white/20 p-1"><SegmentBar topics={m.topics} color="#fff" /></div>
          <p className="ss-num mt-2 text-[14px] text-white/85">{stats.proven} of {stats.lessons} lessons proven{stats.pct !== null ? ` · ${stats.pct}% of the way there` : " · nothing measured yet"}</p>
        </div>
        {resume && (
          <Link href={lessonHref(m.key, resume.key)} className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-bold transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0" style={{ color }}>
            {state === "new" ? "Start the first lesson" : `Continue: ${resume.title}`} <ArrowRight size={16} aria-hidden />
          </Link>
        )}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="lessons-h">
          <h2 id="lessons-h" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">{stats.lessons} {stats.lessons === 1 ? "lesson" : "lessons"}</h2>
          <p className="mt-1 text-[14px] text-[var(--m-muted)]">In order. A lesson turns solid when your work proves it, not when you open it.</p>
          <div className="mt-4"><StationLine m={m} /></div>
        </section>
        {practice.length > 0 && (
          <aside aria-labelledby="inside-h" className="h-fit rounded-2xl border border-[var(--m-rule)] bg-white p-5 lg:sticky lg:top-[140px]">
            <h2 id="inside-h" className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Inside this course</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {practice.map(({ icon: Icon, n, label }) => (
                <li key={label} className="flex items-center gap-3 text-[14px] text-[var(--m-ink)]"><Icon size={16} aria-hidden className="text-[var(--m-muted)]" /><span className="ss-num font-bold">{n}</span> {label}</li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
