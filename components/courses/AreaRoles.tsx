import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { RoleCard } from "@/components/courses/RoleCard";
import type { RoleRow } from "@/lib/courses/find";
import type { StreamSuggestion } from "@/lib/explore/stream";

/** The language that fits a branch best to start with, and one plain sentence for why. */
export const FIRST_LANGUAGE: Record<string, { track: string; title: string; why: string }> = {
  ece: { track: "c", title: "C Programming", why: "Devices and controllers are programmed in C." },
  eee: { track: "c", title: "C Programming", why: "Controllers and PLC-style code start with C." },
  mech: { track: "python", title: "Python", why: "Python is used for automation, calculations and simulation." },
  civil: { track: "python", title: "Python", why: "Python helps with calculations and site data." },
  it: { track: "python", title: "Python", why: "Python is the easiest first language and is used everywhere." },
};

/** A page of role cards for one area, with a plain heading and a way to ask for roles that are not here yet. Server only; takes its data as arguments. */
export function AreaRoles({ title, intro, suggestion, rows, languageKey, banner, tabs }: {
  title: string;
  intro: string;
  suggestion: StreamSuggestion | null;
  rows: readonly RoleRow[];
  languageKey: string | null;
  banner?: React.ReactNode;
  tabs?: React.ReactNode;
}) {
  const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r]));
  const cards = (suggestion?.roles ?? []).flatMap((n) => { const r = byName.get(n.toLowerCase()); return r ? [r] : []; });
  const lang = languageKey ? FIRST_LANGUAGE[languageKey] : undefined;
  return (
    <div className="ss-studio">
      <SkillStudioSubNav />
      <nav aria-label="Breadcrumb" className="pt-5 text-[13.5px] font-bold text-[var(--m-muted)]">
        <Link href="/skillstudio/courses" className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />Courses</Link>
      </nav>
      <header className="mt-4 max-w-[62ch]">
        <h1 className="font-lp-display text-[34px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[44px]">{title}</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-[var(--m-muted)]">{intro}</p>
      </header>
      {tabs}
      {banner}
      <div className="mt-6 flex flex-col gap-6 pb-12">
        {lang && (
          <Link href={`/skillstudio/courses/${lang.track}`} className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[var(--m-ink)] bg-white p-5">
            <span><span className="block text-[12.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]">Start here</span><span className="block font-lp-display text-[22px] font-bold text-[var(--m-ink)]">{lang.title}</span><span className="block text-[14.5px] text-[var(--m-ink)]">{lang.why}</span></span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--m-ink)] px-4 py-2.5 text-[14.5px] font-bold text-white">Open the course<ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" /></span>
          </Link>
        )}
        {cards.length > 0 && (
          <section aria-labelledby="roles">
            <h2 id="roles" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">Jobs you can learn for</h2>
            <p className="mt-1 text-[14.5px] text-[var(--m-muted)]">Open a job to see its path: what to learn first, and what comes next.</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map((r) => <RoleCard key={r.key} roleKey={r.key} name={r.name} blurb={r.description} topics={r.topics.length} />)}</ul>
          </section>
        )}
        {(suggestion?.extra.length ?? 0) > 0 && (
          <section aria-labelledby="ask">
            <h2 id="ask" className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Not here yet</h2>
            <p className="mt-1 text-[14.5px] text-[var(--m-muted)]">We do not have a path for these yet. Tap one to tell us you want it. We build the most asked ones first.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {suggestion!.extra.map((e) => <li key={e.name}><Link href={`/skillstudio/courses/find?q=${encodeURIComponent(e.name)}`} title={e.blurb} className="inline-flex rounded-full border border-[var(--m-rule)] bg-white px-4 py-2 text-[14px] font-bold text-[var(--m-ink)] hover:border-[var(--m-ink)]">{e.name}</Link></li>)}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
