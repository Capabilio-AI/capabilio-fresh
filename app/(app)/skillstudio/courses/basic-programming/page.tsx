import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { TRACKS } from "@/lib/languages";
import { loadProgress, trackProgress } from "@/lib/languages/progress";
import { loadModuleProofs } from "@/lib/languages/module-proof";
import { loadExamLevels } from "@/lib/languages/year-exam";
import { moduleStatuses } from "@/lib/languages/module-gate";
import { allLessons } from "@/lib/languages/types";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Basic programming | SkillStudio | Capabilio AI" };

/** The short mark shown on each language card; plain letters, not a logo. */
const MARK: Record<string, string> = { c: "C", java: "Jv", python: "Py", cpp: "C++", sql: "SQL", html: "</>", javascript: "JS", csharp: "C#" };

/** The two languages that are the best ones to start with. */
const FIRST = new Set(["python", "c"]);

/** Pick a language: one big card per language in a grid, so the whole choice fits on one screen. */
export default async function BasicProgrammingPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const rows = await Promise.all(TRACKS.map(async (t) => {
    const progress = trackProgress(t, await loadProgress(service, user.id, t.key));
    const statuses = moduleStatuses(t, await loadModuleProofs(service, user.id, t.key), await loadExamLevels(service, user.id, t.key));
    return { track: t, progress, proven: statuses.filter((s) => s === "proven").length };
  }));
  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <nav aria-label="Breadcrumb" className="pt-5 text-[13.5px] font-bold text-[var(--m-muted)]">
        <Link href="/skillstudio/courses" className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />Courses</Link>
      </nav>
      <header className="mt-4 max-w-[60ch]">
        <h1 className="font-lp-display text-[34px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[44px]">Pick a language</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-[var(--m-muted)]">Each language is small steps. Read a little, try the code, then pass a short test to open the next step. Not sure where to start? Start with <strong className="text-[var(--m-ink)]">Python</strong> or <strong className="text-[var(--m-ink)]">C</strong>.</p>
      </header>
      <ul className="mt-6 grid gap-4 pb-12 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(({ track, progress, proven }) => (
          <li key={track.key}>
            <Link href={`/skillstudio/courses/${track.key}`} className="group flex h-full flex-col gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-5 transition-colors hover:border-[var(--m-ink)] focus-visible:border-[var(--m-ink)]">
              <span className="flex items-start justify-between gap-2">
                <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--m-ink)] font-lp-mono text-[20px] font-bold text-white">{MARK[track.key] ?? track.title.slice(0, 2)}</span>
                {FIRST.has(track.key) && <span className="rounded-full bg-[var(--m-accent-soft)] px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-accent-ink)]">Good first language</span>}
              </span>
              <span className="block font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">{track.title}</span>
              <span className="block text-[14.5px] leading-snug text-[var(--m-muted)]">{track.tagline}</span>
              <span className="mt-auto flex flex-col gap-2 pt-2">
                <span className="ss-num text-[13px] font-bold text-[var(--m-ink)]">{track.modules.length} steps · {allLessons(track).length} lessons</span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${progress.pct} percent of lessons done, ${proven} of ${track.modules.length} steps passed`}><span className="block h-full rounded-full bg-[var(--m-accent)]" style={{ width: `${progress.pct}%` }} /></span>
                <span className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--m-ink)] px-4 py-2.5 text-[14.5px] font-bold text-white">{progress.done === 0 ? "Start" : "Continue"}<ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" /></span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
