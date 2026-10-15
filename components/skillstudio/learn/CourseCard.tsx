import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { courseHref, courseState, courseStats } from "@/lib/skillstudio/catalog";
import type { LearningModule } from "@/lib/skillstudio/modules";
import { courseColor, STAGE_NAME } from "./palette";
import { RouteGlyph } from "./RouteGlyph";
import { SegmentBar } from "./SegmentBar";

const ACTION = { new: "Start course", "in-progress": "Continue", complete: "Review" } as const;

/** One course on the shelf. The cover is the course's route map in its own colour. */
export function CourseCard({ m }: { m: LearningModule }) {
  const color = courseColor(m.key);
  const stats = courseStats(m);
  const state = courseState(m);
  return (
    <li>
      <Link
        href={courseHref(m.key)}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--m-rule)] bg-white transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--m-ink)] hover:shadow-[0_16px_32px_-18px_rgb(20_20_20/0.4)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <div className="relative px-4 pb-3 pt-4 text-white" style={{ background: color }}>
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold">
            <span className="rounded-full bg-black/20 px-2.5 py-0.5">{STAGE_NAME[m.stage]}</span>
            {m.focus && <span className="rounded-full bg-white px-2.5 py-0.5" style={{ color }}>Learn now</span>}
          </div>
          <RouteGlyph topics={m.topics} className="mt-3 h-14 w-full" />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div>
            <h3 className="font-lp-display text-[19px] font-bold leading-snug text-[var(--m-ink)]">{m.title}</h3>
            {m.description && <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-[var(--m-muted)]">{m.description}</p>}
          </div>
          <SegmentBar topics={m.topics} color={color} />
          <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-[13px]">
            <span className="ss-num text-[var(--m-muted)]">
              {stats.proven} of {stats.lessons} proven{stats.pct !== null ? ` · ${stats.pct}%` : ""}
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-[var(--m-ink)]">
              {ACTION[state]}
              <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
