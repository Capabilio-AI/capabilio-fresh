import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { AreaHero } from "@/components/metro/AreaHero";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { TRACKS } from "@/lib/languages";
import { loadProgress, trackProgress } from "@/lib/languages/progress";
import { allLessons } from "@/lib/languages/types";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Languages | SkillStudio | Capabilio AI" };

export default async function LanguagesPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const rows = await Promise.all(TRACKS.map(async (t) => ({ track: t, progress: trackProgress(t, await loadProgress(service, user.id, t.key)) })));
  return (
    <div className="ss-studio">
      <AreaHero tone="tint" title="Programming languages" intro="Learn a language properly, one lesson at a time. Every lesson ends with questions that show what stuck." nav={<SkillStudioSubNav />} />
      <ul className="grid gap-4 pt-6 sm:grid-cols-2">
        {rows.map(({ track, progress }) => (
          <li key={track.key}>
            <Link href={`/skillstudio/languages/${track.key}`} className="group flex h-full flex-col gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-5 transition-colors hover:border-[var(--m-ink)]">
              <h2 className="font-lp-display text-[26px] font-bold leading-tight text-[var(--m-ink)]">{track.title}</h2>
              <p className="text-[15px] leading-relaxed text-[var(--m-muted)]">{track.tagline}</p>
              <p className="ss-num text-[13.5px] font-bold text-[var(--m-ink)]">{track.modules.length} modules · {allLessons(track).length} lessons</p>
              <div className="mt-auto flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${progress.pct} percent complete`}>
                  <div className="h-full rounded-full bg-[var(--m-accent)]" style={{ width: `${progress.pct}%` }} />
                </div>
                <span className="ss-num text-[13px] font-bold text-[var(--m-ink)]">{progress.done}/{progress.total}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--m-accent-ink)]">{progress.done === 0 ? "Start" : progress.next ? "Continue" : "Review"}<ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
