import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { findTrack } from "@/lib/languages";
import { STAGES, topicTrack } from "@/lib/courses/find";
import { loadRoleRoadmap } from "@/lib/courses/roles-db";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { RoleProofPath } from "@/components/skillstudio/RoleProofPath";
import { ladderStatus, LADDERS } from "@/lib/arena-roles/session/service";
import { supabaseSessionStore } from "@/lib/arena-roles/session/supabase-store";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Job path | SkillStudio | Capabilio AI" };

/**
 * A job's path in four plain stages: start here, main skills, go deeper, get job ready. A topic we already have a course for has a Start button that opens
 * it; the others say they are coming, so a student never taps a button that leads nowhere.
 */
export default async function RolePathPage({ params }: { params: Promise<{ key: string }> }) {
  const { user } = await requireAuthedUser();
  const { key } = await params;
  let road;
  try { road = await loadRoleRoadmap(createServiceClient(), key); } catch (e) {
    console.error("[courses/role] could not load:", e instanceof Error ? e.message : e);
    return <div className="ss-studio"><SkillStudioSubNav /><p role="alert" className="pt-8 text-[15px] font-semibold text-red-700">This path could not be loaded. Please try again in a minute.</p></div>;
  }
  if (!road) notFound();
  // a role with a path of Arena levels shows where the student stands, so learning here and proving in Arena are one path
  const ladder = LADDERS[road.role.key];
  const levels = ladder ? ladderStatus(ladder, await supabaseSessionStore(createServiceClient()).finishedSpecKeys(user.id, road.role.key).catch(() => [])) : null;

  const withCourse = road.topics.flatMap((t) => { const k = topicTrack(t.title); return k ? [k] : []; });
  const startNow = [...new Set(withCourse)].map((k) => findTrack(k)).filter((t) => t !== undefined);
  const known = new Set(STAGES.map((s) => s.key));
  const other = road.topics.filter((t) => !known.has(t.stage));

  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <nav aria-label="Breadcrumb" className="pt-5 text-[13.5px] font-bold text-[var(--m-muted)]">
        <Link href="/skillstudio/courses" className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />Courses</Link>
      </nav>
      <header className="mt-4 max-w-[62ch]">
        <h1 className="font-lp-display text-[34px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[44px]">{road.role.name}</h1>
        {road.role.description && <p className="mt-2 text-[16px] leading-relaxed text-[var(--m-muted)]">{road.role.description}</p>}
        <p className="mt-2 text-[14.5px] font-bold text-[var(--m-ink)]">{road.topics.length} topics, in 4 stages. Go from the top to the bottom.</p>
      </header>

      {levels && <RoleProofPath roleName={road.role.name} levels={levels} />}

      {startNow.length > 0 && (
        <section aria-labelledby="start-now" className="mt-6 rounded-2xl border-2 border-[var(--m-ink)] bg-white p-5">
          <h2 id="start-now" className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Start today</h2>
          <p className="mt-1 text-[14.5px] text-[var(--m-muted)]">We already have these courses for this job.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {startNow.map((t) => <li key={t.key}><Link href={`/skillstudio/courses/${t.key}`} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--m-ink)] px-4 py-2.5 text-[14.5px] font-bold text-white">{t.title}<ArrowRight size={14} aria-hidden /></Link></li>)}
          </ul>
        </section>
      )}

      <ol className="mt-6 flex flex-col gap-6 pb-12">
        {STAGES.map((s, si) => {
          const topics = road.topics.filter((t) => t.stage === s.key);
          if (topics.length === 0) return null;
          return (
            <li key={s.key}>
              <section aria-labelledby={`st-${s.key}`}>
                <h2 id={`st-${s.key}`} className="flex items-center gap-3 font-lp-display text-[24px] font-bold text-[var(--m-ink)]">
                  <span aria-hidden className="ss-num flex h-9 w-9 items-center justify-center rounded-full bg-[var(--m-ink)] text-[16px] text-white">{si + 1}</span>{s.title}
                </h2>
                <p className="mt-1 text-[14.5px] text-[var(--m-muted)]">{s.blurb}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {topics.map((t, ti) => {
                    const k = topicTrack(t.title);
                    const course = k ? findTrack(k) : undefined;
                    return (
                      <li key={`${t.title}-${ti}`} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--m-rule)] bg-white px-4 py-3">
                        <span className="min-w-0">
                          <span className="block text-[15.5px] font-bold text-[var(--m-ink)]">{t.title}</span>
                          {t.description && <span className="line-clamp-2 text-[13.5px] leading-snug text-[var(--m-muted)]">{t.description}</span>}
                        </span>
                        {course
                          ? <Link href={`/skillstudio/courses/${course.key}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#17784a] px-3.5 py-2 text-[13.5px] font-bold text-white">Start<ArrowRight size={13} aria-hidden /></Link>
                          : <span className="shrink-0 rounded-full bg-[var(--m-ground)] px-3 py-1 text-[12px] font-bold text-[var(--m-muted)]">Coming soon</span>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </li>
          );
        })}
        {other.length > 0 && (
          <li><section aria-labelledby="st-other"><h2 id="st-other" className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">More topics</h2>
            <ul className="mt-3 flex flex-col gap-2">{other.map((t, i) => <li key={`${t.title}-${i}`} className="rounded-xl border border-[var(--m-rule)] bg-white px-4 py-3 text-[15px] font-bold text-[var(--m-ink)]">{t.title}</li>)}</ul></section></li>
        )}
      </ol>
    </div>
  );
}
