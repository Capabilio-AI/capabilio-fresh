import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { lessonHref, type Pick } from "@/lib/skillstudio/catalog";
import { StationMark } from "@/components/roadmap/visual/StationMark";
import { courseColor } from "./palette";

const NOTE: Record<Pick["reason"], (p: Pick) => string> = {
  continue: () => "You are learning this",
  start: () => "Not assessed yet",
  gap: (p) => `${p.topic.level}% of ${p.topic.target}%`,
};

/** More lessons worth doing after the main one: a plain list, one row each, so it scans instead of competing with the courses. */
export function UpNextList({ picks }: { picks: Pick[] }) {
  if (picks.length === 0) return null;
  return (
    <section aria-labelledby="more-h" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
      <h2 id="more-h" className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Also worth your time</h2>
      <ul className="mt-3 flex flex-col">
        {picks.map((p) => (
          <li key={p.topic.key} className="border-t border-[var(--m-rule)] first:border-t-0">
            <Link href={lessonHref(p.module.key, p.topic.key)} className="group flex items-center gap-3 py-3">
              <StationMark status={p.topic.status} color={courseColor(p.module.key)} size={20} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-bold text-[var(--m-ink)]">{p.topic.title}</span>
                <span className="block truncate text-[12.5px] text-[var(--m-muted)]">{p.module.title}</span>
              </span>
              <span className="ss-num hidden shrink-0 text-[12.5px] text-[var(--m-muted)] sm:block">{NOTE[p.reason](p)}</span>
              <ArrowRight size={15} aria-hidden className="shrink-0 text-[var(--m-muted)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
