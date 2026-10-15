"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import clsx from "clsx";
import { filterCourses, type CourseFilter } from "@/lib/skillstudio/catalog";
import type { LearningModule } from "@/lib/skillstudio/modules";
import { CourseCard } from "./CourseCard";
import { STAGE_NAME, STAGE_ORDER } from "./palette";
import "./studio.css";

/** The path as a shelf of courses. Search and filters work instantly in the browser; nothing is requested while typing. */
export function CourseShelf({ modules, careerName }: { modules: LearningModule[]; careerName: string }) {
  const [stage, setStage] = useState<CourseFilter>("all");
  const [query, setQuery] = useState("");

  const chips = useMemo(() => {
    const all: { key: CourseFilter; label: string }[] = [{ key: "all", label: "All courses" }, { key: "now", label: "Learn now" }, ...STAGE_ORDER.map((s) => ({ key: s as CourseFilter, label: STAGE_NAME[s] }))];
    return all.map((c) => ({ ...c, count: filterCourses(modules, { stage: c.key, query }).length })).filter((c) => c.key === "all" || c.count > 0 || c.key === stage);
  }, [modules, query, stage]);
  const shown = useMemo(() => filterCourses(modules, { stage, query }), [modules, stage, query]);

  return (
    <section aria-labelledby="shelf-h" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="shelf-h" className="font-lp-display text-[26px] font-bold text-[var(--m-ink)]">Your {careerName} courses</h2>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search courses and lessons</span>
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--m-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses and lessons"
            className="w-full rounded-full border border-[var(--m-rule)] bg-white py-2.5 pl-10 pr-4 text-[14px] text-[var(--m-ink)] placeholder:text-[var(--m-muted)] focus:border-[var(--m-ink)] focus:outline-none"
          />
        </label>
      </div>

      <div role="group" aria-label="Filter courses" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 ss-scroll">
        {chips.map((c) => {
          const on = stage === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => setStage(c.key)}
              className={clsx("shrink-0 rounded-full border px-3.5 py-1.5 text-[13.5px] font-bold transition-colors motion-reduce:transition-none", on ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-[var(--m-rule)] bg-white text-[var(--m-ink)] hover:border-[var(--m-ink)]")}
            >
              {c.label} <span className={clsx("ss-num font-normal", on ? "text-white/70" : "text-[var(--m-muted)]")}>{c.count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--m-off)] bg-white px-6 py-14 text-center">
          <SearchX size={22} aria-hidden className="text-[var(--m-muted)]" />
          <p className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Nothing matches &ldquo;{query}&rdquo;</p>
          <button type="button" onClick={() => { setQuery(""); setStage("all"); }} className="text-[13.5px] font-bold text-[var(--m-accent-ink)] hover:underline">Clear search and filters</button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((m) => <CourseCard key={m.key} m={m} />)}
        </ul>
      )}
    </section>
  );
}
