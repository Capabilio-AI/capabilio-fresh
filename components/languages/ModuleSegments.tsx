import Link from "next/link";

/**
 * Where the student is in the module: one segment per lesson, green once done, dark for this one. Each segment is a link, so it doubles as navigation.
 * "Lesson 2 of 4" is the text; the bars are decoration for sighted users and each carries its own accessible name.
 */
export function ModuleSegments({ track, moduleTitle, lessons, done, current, minutes }: {
  track: string;
  moduleTitle: string;
  lessons: { key: string; title: string }[];
  done: Readonly<Record<string, unknown>>;
  current: string;
  minutes: number;
}) {
  const at = lessons.findIndex((l) => l.key === current);
  const finished = lessons.filter((l) => done[l.key]).length;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-baseline gap-x-3 text-[13.5px] font-bold text-[var(--m-muted)]">
        <span>{moduleTitle}</span>
        <span className="ss-num text-[var(--m-ink)]">Lesson {at + 1} of {lessons.length}</span>
        <span>{minutes} min</span>
        <span className="ss-num ml-auto">{finished}/{lessons.length} done</span>
      </p>
      <ol className="flex gap-1.5" aria-label={`Lessons in ${moduleTitle}`}>
        {lessons.map((l, i) => {
          const isDone = Boolean(done[l.key]);
          const isNow = l.key === current;
          return (
            <li key={l.key} className="min-w-0 flex-1">
              <Link href={`/skillstudio/courses/${track}/${l.key}`} aria-current={isNow ? "step" : undefined} aria-label={`${i + 1}. ${l.title}${isDone ? " (done)" : ""}`} title={l.title}
                className={`block h-2 rounded-full transition-colors motion-reduce:transition-none ${isNow ? "bg-[var(--m-ink)]" : isDone ? "bg-[#17784a]" : "bg-[var(--m-rule)] hover:bg-[var(--m-muted)]"}`} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
