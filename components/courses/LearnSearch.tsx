import Link from "next/link";
import { Search } from "lucide-react";

/** Things a student can tap instead of typing. */
export const EXAMPLES = ["Embedded systems", "Web development", "Data analysis", "Python", "Placement coding", "Mobile apps"];

/**
 * "What do you want to learn?" A plain form (it works without script and on a slow phone) with example topics to tap, because typing in English is itself
 * a hurdle for many students.
 */
export function LearnSearch({ initial = "", heading = "What do you want to learn?" }: { initial?: string; heading?: string }) {
  return (
    <section aria-labelledby="learn-search" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <h2 id="learn-search" className="font-lp-display text-[24px] font-bold leading-tight text-[var(--m-ink)]">{heading}</h2>
      <form action="/skillstudio/courses/find" method="get" role="search" className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="learn-q">Type a topic</label>
        <input id="learn-q" name="q" defaultValue={initial} maxLength={80} autoComplete="off" placeholder="For example: embedded systems"
          className="h-12 min-w-0 flex-1 rounded-xl border border-[var(--m-rule)] bg-white px-4 text-[16px] text-[var(--m-ink)] placeholder:text-[var(--m-muted)]" />
        <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--m-ink)] px-6 text-[15px] font-bold text-white"><Search size={17} aria-hidden />Search</button>
      </form>
      <p className="mt-3 text-[13.5px] font-bold text-[var(--m-muted)]">Or tap one:</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => <li key={e}><Link href={`/skillstudio/courses/find?q=${encodeURIComponent(e)}`} className="inline-flex rounded-full border border-[var(--m-rule)] bg-[var(--m-ground)] px-4 py-2 text-[14px] font-bold text-[var(--m-ink)] hover:border-[var(--m-ink)]">{e}</Link></li>)}
      </ul>
    </section>
  );
}
