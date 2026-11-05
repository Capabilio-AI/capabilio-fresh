import Link from "next/link";
import { ArrowRight, Award, Check, FolderKanban, Hammer, Layers, Rocket, Sparkles, Target, type LucideIcon } from "lucide-react";
import type { Stage } from "@/lib/roadmap-visual/graph-types";
import { courseHref, courseState, courseStats } from "@/lib/skillstudio/catalog";
import type { LearningModule } from "@/lib/skillstudio/modules";
import { courseColor, STAGE_NAME } from "./palette";
import { RouteGlyph } from "./RouteGlyph";
import { SegmentBar } from "./SegmentBar";

const ACTION = { new: "Start", "in-progress": "Continue", complete: "Review" } as const;
const STAGE_ICON: Record<Stage, LucideIcon> = { FOUNDATION: Layers, CORE: Hammer, SPECIALIZATION: Sparkles, JOB_READY: Rocket };
const CHIPS = 2;
const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

/** One course on the shelf, compact. The cover is the course's route map in its own colour; the body says what is next and what practice backs it. */
export function CourseCard({ m }: { m: LearningModule }) {
  const color = courseColor(m.key);
  const stats = courseStats(m);
  const state = courseState(m);
  const StageIcon = STAGE_ICON[m.stage];
  const next = m.topics.find((t) => t.status !== "TARGET_MET");
  const pct = stats.pct ?? 0;
  const practice = [
    { Icon: Target, n: m.practice.arena, label: "arena" },
    { Icon: FolderKanban, n: m.practice.projects, label: "projects" },
    { Icon: Award, n: m.practice.certifications, label: "certifications" },
  ].filter((p) => p.n > 0);
  return (
    <li>
      <Link
        href={courseHref(m.key)}
        style={{ ["--c" as string]: color }}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--m-rule)] bg-white transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--c)] hover:shadow-[0_14px_28px_-14px_var(--c)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <div className="ss-cover px-3 pb-2 pt-3 text-white" style={{ background: `radial-gradient(circle at 90% 0%, rgb(255 255 255 / 0.25), transparent 55%), linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 68%, black))` }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5"><StageIcon size={11} aria-hidden />{STAGE_NAME[m.stage]}</span>
              {m.focus && <span className="rounded-full bg-white px-2 py-0.5" style={{ color }}>Learn now</span>}
            </div>
            <div className="relative size-9 shrink-0" role="img" aria-label={stats.pct === null ? "Not measured yet" : `${pct}% complete`}>
              <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                <circle cx="18" cy="18" r={RING_R} fill="rgb(0 0 0 / 0.18)" stroke="rgb(255 255 255 / 0.3)" strokeWidth="3" />
                <circle cx="18" cy="18" r={RING_R} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - pct / 100)} className="ss-ring-arc" />
              </svg>
              <span className="ss-num absolute inset-0 grid place-items-center text-[10px] font-bold">{state === "complete" ? <Check size={14} aria-hidden /> : stats.pct === null ? "–" : pct}</span>
            </div>
          </div>
          <RouteGlyph topics={m.topics} className="mt-1.5 h-9 w-full" />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div>
            <h3 className="font-lp-display text-[16px] font-bold leading-snug text-[var(--m-ink)]">{m.title}</h3>
            {m.description && <p className="mt-0.5 line-clamp-1 text-[12.5px] leading-snug text-[var(--m-muted)]">{m.description}</p>}
          </div>
          <div className="flex flex-wrap gap-1">
            {m.topics.slice(0, CHIPS).map((t) => (
              <span key={t.key} className="max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${color} 10%, white)`, color }}>{t.title}</span>
            ))}
            {m.topics.length > CHIPS && <span className="px-0.5 py-0.5 text-[11px] font-bold text-[var(--m-muted)]">+{m.topics.length - CHIPS}</span>}
          </div>
          <p className="truncate text-[12px] text-[var(--m-muted)]">
            {next ? <><span className="font-bold text-[var(--m-ink)]">{state === "new" ? "Starts with" : "Up next"}</span> · {next.title}</> : <span className="font-bold text-[var(--m-ink)]">Every lesson proven</span>}
          </p>
          <SegmentBar topics={m.topics} color={color} />
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-[var(--m-rule)] pt-2 text-[12px]">
            <span className="ss-num flex items-center gap-2 text-[var(--m-muted)]">
              <span>{stats.proven}/{stats.lessons}</span>
              {practice.map(({ Icon, n, label }) => (
                <span key={label} className="inline-flex items-center gap-0.5" title={`${n} ${label}`}><Icon size={12} aria-hidden /><span className="sr-only">{label}</span>{n}</span>
              ))}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-bold text-white transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" style={{ background: color }}>
              {ACTION[state]}
              <ArrowRight size={12} aria-hidden />
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
