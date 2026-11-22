import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { TRACKS, findTrack } from "@/lib/languages";
import { recommendedTracks, searchLanguages, searchRoles, searchWords, type RoleHit } from "@/lib/courses/find";
import { loadRoleRows } from "@/lib/courses/roles-db";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { LearnSearch } from "@/components/courses/LearnSearch";
import { RoleCard } from "@/components/courses/RoleCard";
import { GoalBox } from "@/components/pathways/GoalBox";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Find a course | SkillStudio | Capabilio AI" };

const KIND = { course: "Course", module: "Step", lesson: "Lesson" } as const;

/** What to learn for the words a student typed: courses to start now, lessons about it, and the job roles that use it. Reads our own catalogue only. */
export default async function FindPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAuthedUser();
  const q = ((await searchParams).q ?? "").slice(0, 80);
  const words = searchWords(q);
  const recs = recommendedTracks(words);
  const recKeys = new Set(recs.map((r) => r.track));
  const lessons = searchLanguages(words, TRACKS, 8).filter((h) => !(h.kind === "course" && recKeys.has(h.track)));
  let roles: RoleHit[] = [];
  let rolesDown = false;
  if (words.length > 0) {
    try { roles = searchRoles(words, await loadRoleRows(createServiceClient())); } catch (e) { rolesDown = true; console.error("[courses/find] roles unavailable:", e instanceof Error ? e.message : e); }
  }
  const nothing = words.length > 0 && recs.length === 0 && lessons.length === 0 && roles.length === 0 && !rolesDown;

  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <nav aria-label="Breadcrumb" className="pt-5 text-[13.5px] font-bold text-[var(--m-muted)]">
        <Link href="/skillstudio/courses" className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />Courses</Link>
      </nav>
      <div className="mt-4 flex flex-col gap-6 pb-12">
        <LearnSearch initial={q} heading={words.length > 0 ? `You searched: ${q}` : "What do you want to learn?"} />

        {recs.length > 0 && (
          <section aria-labelledby="start">
            <h2 id="start" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">Start with this</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recs.map(({ track, why }) => (
                <li key={track}>
                  <Link href={`/skillstudio/courses/${track}`} className="group flex h-full flex-col gap-2 rounded-2xl border-2 border-[var(--m-ink)] bg-white p-5">
                    <span className="font-lp-display text-[21px] font-bold text-[var(--m-ink)]">{findTrack(track)?.title ?? track}</span>
                    <span className="text-[14.5px] leading-snug text-[var(--m-ink)]">{why}</span>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14.5px] font-bold text-[var(--m-accent-ink)]">Open the course<ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {lessons.length > 0 && (
          <section aria-labelledby="lessons">
            <h2 id="lessons" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">Lessons about this</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {lessons.map((h) => (
                <li key={h.href}>
                  <Link href={h.href} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--m-rule)] bg-white px-4 py-3 hover:border-[var(--m-ink)]">
                    <span className="min-w-0"><span className="block text-[15.5px] font-bold text-[var(--m-ink)]">{h.title}</span><span className="block truncate text-[13px] text-[var(--m-muted)]">{h.trail}</span></span>
                    <span className="shrink-0 rounded-full bg-[var(--m-ground)] px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{KIND[h.kind]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {roles.length > 0 && (
          <section aria-labelledby="jobs">
            <h2 id="jobs" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">Jobs that use this</h2>
            <p className="mt-1 text-[14.5px] text-[var(--m-muted)]">Open a job to see the full path: what to learn first, and what comes next.</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roles.map((r) => <RoleCard key={r.key} roleKey={r.key} name={r.name} topics={r.topicCount} note={r.matched.length > 0 ? `Includes: ${r.matched.slice(0, 3).join(", ")}` : undefined} />)}
            </ul>
          </section>
        )}
        {rolesDown && <p role="status" className="text-[14px] text-[var(--m-muted)]">The list of jobs is not available right now. The courses above still work.</p>}

        {nothing && (
          <section aria-labelledby="none" className="flex flex-col gap-3">
            <h2 id="none" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">We do not have a course for “{q}” yet</h2>
            <p className="max-w-[60ch] text-[15px] leading-relaxed text-[var(--m-muted)]">Tell us what you want to learn. We write down what students ask for, and we build the most asked ones first.</p>
            <GoalBox heading="Tell us what you want to learn" />
          </section>
        )}
        {words.length === 0 && <p className="text-[15px] text-[var(--m-muted)]">Type a topic above, or tap one of the examples.</p>}
      </div>
    </div>
  );
}
