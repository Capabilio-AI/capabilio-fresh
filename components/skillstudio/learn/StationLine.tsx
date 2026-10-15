import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { lessonHref } from "@/lib/skillstudio/catalog";
import type { LearningModule } from "@/lib/skillstudio/modules";
import { STATUS_META } from "@/components/roadmap/visual/meta";
import { StationMark } from "@/components/roadmap/visual/StationMark";
import { courseColor } from "./palette";

/**
 * A course as a metro line: one station per lesson in order, the line drawn through them, the next open lesson pulsing. Status is the
 * station's shape and a word, never colour alone.
 */
export function StationLine({ m, currentKey }: { m: LearningModule; currentKey?: string }) {
  const color = courseColor(m.key);
  const nextKey = currentKey ?? m.topics.find((t) => t.status !== "TARGET_MET" && t.status !== "SKIPPED" && t.status !== "LOCKED")?.key;
  return (
    <ol className="relative">
      {m.topics.map((t, i) => {
        const here = t.key === currentKey;
        const first = i === 0;
        const last = i === m.topics.length - 1;
        const meta = STATUS_META[t.status];
        return (
          <li key={t.key} className="relative pl-12">
            <span aria-hidden className="absolute left-[15px] w-1 rounded-full" style={{ background: color, opacity: 0.35, top: first ? "1.6rem" : 0, bottom: last ? "calc(100% - 1.6rem)" : 0 }} />
            <span className="absolute left-1 top-4"><StationMark status={t.status} color={color} size={26} next={t.key === nextKey} /></span>
            <Link
              href={lessonHref(m.key, t.key)}
              aria-current={here ? "page" : undefined}
              className={`group my-1 flex items-center gap-3 rounded-xl px-3 py-3 transition-colors motion-reduce:transition-none ${here ? "bg-[var(--m-accent-soft)]" : "hover:bg-[var(--m-ground)]"}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-bold leading-snug text-[var(--m-ink)]">{t.title}</span>
                {t.description && !here && <span className="mt-0.5 line-clamp-1 block text-[13px] text-[var(--m-muted)]">{t.description}</span>}
                <span className="ss-num mt-1 flex flex-wrap items-center gap-x-3 text-[12.5px] text-[var(--m-muted)]">
                  <span className="font-bold text-[var(--m-ink)]">{meta.label}</span>
                  <span>{t.level === null ? "Not assessed" : `${t.level}%`}{t.target !== null ? ` of ${t.target}%` : ""}</span>
                  {t.learning > 0 && <span className="inline-flex items-center gap-1"><BookOpen size={12} aria-hidden />{t.learning} {t.learning === 1 ? "resource" : "resources"}</span>}
                </span>
              </span>
              <ArrowRight size={15} aria-hidden className="shrink-0 text-[var(--m-muted)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
