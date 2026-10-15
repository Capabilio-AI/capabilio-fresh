import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { lessonHref, type Pick } from "@/lib/skillstudio/catalog";
import { LevelTrack } from "./LevelTrack";
import "./studio.css";

const WHY: Record<Pick["reason"], (p: Pick, career: string) => string> = {
  continue: () => "You marked this as learning. Pick it back up.",
  start: (_p, career) => `Nothing has measured this yet, and ${career} roles use it. Learn it, then prove it in Arena.`,
  gap: (p, career) => `You are at ${p.topic.level}% and ${career} roles ask for ${p.topic.target}%. It is the biggest gap in what you should learn now.`,
};

/** The one thing to do next, with where the student stands on it. The rest of the page is browsing. */
export function ResumeBand({ pick, careerName, summary }: { pick: Pick | null; careerName: string; summary: string }) {
  if (!pick) {
    return (
      <section aria-labelledby="band-h" className="rounded-3xl bg-[var(--m-ink)] p-6 text-white sm:p-8">
        <h2 id="band-h" className="font-lp-display text-[28px] font-bold leading-tight sm:text-[34px]">Every lesson on your path is proven or set aside.</h2>
        <p className="mt-2 max-w-xl text-[15px] text-white/75">Take on a harder Arena challenge or a project to keep building proof for {careerName} roles.</p>
        <Link href="/arena" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--m-accent)] px-5 py-3 text-[14.5px] font-bold text-[var(--m-ink)]">Go to Arena <ArrowRight size={15} aria-hidden /></Link>
      </section>
    );
  }
  return (
    <section aria-labelledby="band-h" className="relative overflow-hidden rounded-3xl bg-[var(--m-ink)] p-6 text-white sm:p-8">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-[var(--m-accent)]/30" />
      <div className="relative grid gap-6 md:grid-cols-[1fr_20rem] md:items-end">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-white/70">{pick.reason === "continue" ? "Continue" : "Up next"} in {pick.module.title}</p>
          <h2 id="band-h" className="mt-1.5 text-balance font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight sm:text-[42px]">{pick.topic.title}</h2>
          <p className="mt-2.5 max-w-[56ch] text-[15px] leading-relaxed text-white/75">{WHY[pick.reason](pick, careerName)}</p>
          <Link href={lessonHref(pick.module.key, pick.topic.key)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--m-accent)] px-6 py-3 text-[15px] font-bold text-[var(--m-ink)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
            {pick.reason === "continue" ? "Continue lesson" : "Start lesson"} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="rounded-2xl bg-white/[0.07] p-4">
          <LevelTrack level={pick.topic.level} target={pick.topic.target} tone="dark" />
          <p className="mt-3 border-t border-white/10 pt-3 text-[13px] text-white/70">{summary}</p>
        </div>
      </div>
    </section>
  );
}
