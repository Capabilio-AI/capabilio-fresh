import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { TRACKS } from "@/lib/languages";
import { loadProgress, trackProgress } from "@/lib/languages/progress";
import { loadModuleProofs } from "@/lib/languages/module-proof";
import { moduleStatuses } from "@/lib/languages/module-gate";
import { allLessons } from "@/lib/languages/types";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Basic programming | SkillStudio | Capabilio AI" };

/** The short mark shown on each language card; plain letters, not a logo. */
const MARK: Record<string, string> = { c: "C", java: "Jv", python: "Py", cpp: "C++", sql: "SQL", html: "</>", javascript: "JS", csharp: "C#" };

/** Which language do you want to learn? One card per language, with where the student is in it. */
export default async function BasicProgrammingPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const rows = await Promise.all(TRACKS.map(async (t) => {
    const progress = trackProgress(t, await loadProgress(service, user.id, t.key));
    const statuses = moduleStatuses(t, await loadModuleProofs(service, user.id, t.key));
    return { track: t, progress, proven: statuses.filter((s) => s === "proven").length };
  }));
  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <nav aria-label="Breadcrumb" className="pt-5 text-[13.5px] font-bold text-[var(--m-muted)]">
        <Link href="/skillstudio/courses" className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />Courses</Link>
      </nav>
      <header className="mt-4 max-w-[60ch]">
        <h1 className="font-lp-display text-[34px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[44px]">Which language do you want to learn?</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-[var(--m-muted)]">Each language is a series of modules. Read a little, try it yourself beside the lesson, then prove the module with a short test and one problem. Prove a module to open the next.</p>
      </header>
      <ul className="mt-6 flex flex-col gap-3 pb-12">
        {rows.map(({ track, progress, proven }) => (
          <li key={track.key}>
            <Link href={`/skillstudio/courses/${track.key}`} className="group flex items-center gap-4 rounded-2xl border border-[var(--m-rule)] bg-white p-4 transition-colors hover:border-[var(--m-ink)] sm:p-5">
              <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--m-ink)] font-lp-mono text-[15px] font-bold text-white">{MARK[track.key] ?? track.title.slice(0, 2)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">{track.title}</span>
                <span className="mt-0.5 block text-[14.5px] leading-snug text-[var(--m-muted)]">{track.tagline}</span>
                <span className="ss-num mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-bold text-[var(--m-ink)]">
                  <span>{track.modules.length} modules · {allLessons(track).length} lessons</span>
                  <span className="text-[var(--m-accent-ink)]">{proven}/{track.modules.length} modules proven</span>
                </span>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${progress.pct} percent of lessons complete`}><span className="block h-full rounded-full bg-[var(--m-accent)]" style={{ width: `${progress.pct}%` }} /></span>
              </span>
              <span className="hidden items-center gap-1.5 text-[14px] font-bold text-[var(--m-accent-ink)] sm:inline-flex">{progress.done === 0 ? "Start" : "Continue"}<ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
