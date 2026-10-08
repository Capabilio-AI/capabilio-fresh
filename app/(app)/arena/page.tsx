import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, FolderKanban, GraduationCap, Database, Trophy } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getLeaderboard } from "@/lib/arena/data";
import { ArenaSubNav } from "@/components/arena/ArenaSubNav";
import { AreaHero, HeroStat } from "@/components/metro/AreaHero";

export const metadata: Metadata = { title: "Arena | Capabilio AI", description: "Execute, compete, and prove your skills." };

const CARD = "group flex h-full flex-col gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-5 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--m-ink)] hover:shadow-[0_8px_20px_-8px_rgba(20,20,20,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export default async function ArenaHubPage() {
  const { supabase, user } = await requireAuthedUser();
  const leaderboard = await getLeaderboard(supabase, user.id);
  const viewer = leaderboard.find((e) => e.isViewer);
  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3, 8);

  return (
    <div className="flex flex-col gap-6">
      <AreaHero
        tone="dark"
        title="Arena"
        intro="Where you execute. Timed challenges, projects and competitions that turn skill into proof."
        aside={<><HeroStat tone="dark" value={viewer ? viewer.rating : "Unrated"} label="Your rating" />{viewer && <HeroStat tone="dark" value={`#${viewer.rank}`} label="Your rank" />}</>}
        nav={<ArenaSubNav />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="modes-h" className="flex flex-col gap-4">
          <h2 id="modes-h" className="font-lp-display text-[28px] font-bold text-[var(--m-ink)]">Choose how to play</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link href="/arena/challenges/stream" className={CARD}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--m-accent-soft)] text-[var(--m-accent)]"><GraduationCap size={21} aria-hidden /></span>
              <h3 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Stream challenges</h3>
              <p className="font-lp-body text-[14px] leading-relaxed text-app-muted">Eight fresh problems every Monday, drawn from your own branch and subjects.</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13.5px] font-bold text-[var(--m-accent)]">Play this week <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" /></span>
            </Link>
            <Link href="/arena/challenges/domain" className={CARD}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--m-accent-soft)] text-[var(--m-accent)]"><Database size={21} aria-hidden /></span>
              <h3 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Domain challenges</h3>
              <p className="font-lp-body text-[14px] leading-relaxed text-app-muted">Real work tickets for your target career, with industry-style data and tools.</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13.5px] font-bold text-[var(--m-accent)]">Take a ticket <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" /></span>
            </Link>
            <Link href="/arena/projects" className={CARD}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--m-ground)] text-[var(--m-ink)]"><FolderKanban size={21} aria-hidden /></span>
              <h3 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Projects</h3>
              <p className="font-lp-body text-[14px] leading-relaxed text-app-muted">Guided builds from your career roadmap that become portfolio evidence.</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13.5px] font-bold text-[var(--m-ink)]">See projects <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" /></span>
            </Link>
            <Link href="/arena/competitions" className={CARD}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--m-ground)] text-[var(--m-ink)]"><Trophy size={21} aria-hidden /></span>
              <h3 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Competitions</h3>
              <p className="font-lp-body text-[14px] leading-relaxed text-app-muted">Hackathons and datathons with teams and deadlines. Early access.</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13.5px] font-bold text-[var(--m-ink)]">Learn more <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" /></span>
            </Link>
          </div>
        </section>

        <section aria-labelledby="lb-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6">
          <h2 id="lb-h" className="font-lp-display text-[28px] font-bold text-[var(--m-ink)]">Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p className="mt-3 font-lp-body text-[14px] text-app-muted">No ratings yet. Complete a challenge to take the first place.</p>
          ) : (
            <>
              <ol className="mt-5 grid grid-cols-3 items-end gap-2">
                {[podium[1], podium[0], podium[2]].map((e, i) => e ? (
                  <li key={e.userId} className={`flex flex-col items-center rounded-2xl px-2 pb-3 pt-4 text-center ${i === 1 ? "bg-[var(--m-ink)] pb-5 pt-6 text-white" : "bg-[var(--m-ground)] text-[var(--m-ink)]"}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-bold ${i === 1 ? "bg-[var(--m-accent)] text-white" : "bg-white"}`}>{e.rank}</span>
                    <span className="mt-2 line-clamp-2 text-[13px] font-bold leading-tight">{e.name ?? "Student"}{e.isViewer && " (you)"}</span>
                    <span className="mt-1 font-lp-display text-[18px] font-bold">{e.rating}</span>
                  </li>
                ) : <li key={i} />)}
              </ol>
              {rest.length > 0 && (
                <ol start={4} className="mt-4 flex flex-col gap-1.5">
                  {rest.map((e) => (
                    <li key={e.userId} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${e.isViewer ? "bg-[var(--m-accent-soft)] ring-1 ring-[var(--m-accent)]" : "bg-[var(--m-ground)]"}`}>
                      <span className="flex items-center gap-3"><span className="w-6 text-[13px] font-bold text-[var(--m-muted)]">{e.rank}</span><span className="text-[14px] font-bold text-[var(--m-ink)]">{e.name ?? "Student"}{e.isViewer && " (you)"}</span></span>
                      <span className="font-lp-display text-[16px] font-bold text-[var(--m-ink)]">{e.rating}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
