import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ExternalLink } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { findTrack } from "@/lib/languages";
import { loadProgress, trackProgress } from "@/lib/languages/progress";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Language track | SkillStudio | Capabilio AI" };

export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track: key } = await params;
  const track = findTrack(key);
  if (!track) notFound();
  const { user } = await requireAuthedUser();
  const progress = await loadProgress(createServiceClient(), user.id, track.key);
  const stats = trackProgress(track, progress);

  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <nav aria-label="Breadcrumb" className="pt-5 text-[13.5px] font-bold text-[var(--m-muted)]">
        <Link href="/skillstudio/languages" className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />Languages</Link>
      </nav>
      <header className="mt-4 flex flex-col gap-3">
        <h1 className="text-balance font-lp-display text-[32px] font-bold leading-[1.06] tracking-tight text-[var(--m-ink)] sm:text-[44px]">{track.title}</h1>
        <p className="max-w-[64ch] text-[16px] leading-relaxed text-[var(--m-ink)]">{track.outcome}</p>
        <p className="ss-num text-[14px] font-bold text-[var(--m-ink)]">{stats.done} of {stats.total} lessons complete ({stats.pct}%)</p>
        {stats.next && (
          <Link href={`/skillstudio/languages/${track.key}/${stats.next.lessonKey}`} className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white">
            {stats.done === 0 ? "Start" : "Continue"}: {stats.next.title}<ArrowRight size={15} aria-hidden />
          </Link>
        )}
      </header>

      <ol className="mt-8 flex flex-col gap-5">
        {track.modules.map((m, mi) => {
          const done = m.lessons.filter((l) => progress[l.key]).length;
          return (
            <li key={m.key} className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]"><span className="ss-num text-[var(--m-muted)]">{mi + 1}.</span> {m.title}</h2>
                <span className="ss-num text-[13px] font-bold text-[var(--m-muted)]">{done}/{m.lessons.length}</span>
              </div>
              <p className="mt-1 max-w-[64ch] text-[14.5px] leading-relaxed text-[var(--m-muted)]">{m.summary}</p>
              <ul className="mt-3 flex flex-col divide-y divide-[var(--m-rule)]">
                {m.lessons.map((l) => {
                  const p = progress[l.key];
                  return (
                    <li key={l.key}>
                      <Link href={`/skillstudio/languages/${track.key}/${l.key}`} className="flex items-center gap-3 py-2.5 text-[15px] text-[var(--m-ink)] hover:text-[var(--m-accent-ink)]">
                        <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--m-rule)]">{p && <Check size={12} />}</span>
                        <span className="min-w-0 flex-1 font-bold">{l.title}</span>
                        {p && <span className="ss-num text-[12.5px] text-[var(--m-muted)]">{p.correct}/{p.total} right</span>}
                        <span className="ss-num text-[12.5px] text-[var(--m-muted)]">{l.minutes} min</span>
                        <span className="sr-only">{p ? "completed" : "not started"}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <section aria-labelledby="refs" className="mt-8 rounded-2xl bg-[var(--m-ground)] p-5">
        <h2 id="refs" className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Where to read more</h2>
        <p className="mt-1 text-[14px] text-[var(--m-muted)]">These lessons were written by the Capabilio team. Check details against the official references below.</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {track.references.map((r) => (
            <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14.5px] font-bold text-[var(--m-accent-ink)] hover:underline">{r.title}<ExternalLink size={13} aria-hidden /></a></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
