import Link from "next/link";
import { Check, Lock } from "lucide-react";
import type { Track } from "@/lib/languages/types";
import type { ModuleStatus } from "@/lib/languages/module-gate";

/** The chapter list of a language track: every lesson grouped by unit, a tick on the ones done and the current one marked. Plain links, so it works without script. */
function Chapters({ track, current, done, locked }: { track: Track; current: string; done: Record<string, unknown>; locked: readonly ModuleStatus[] }) {
  return (
    <nav aria-label={`${track.title} lessons`} className="flex flex-col gap-4">
      {track.modules.map((m, mi) => (
        <div key={m.key}>
          <p className="flex items-center gap-1.5 px-2 text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{locked[mi] === "locked" && <Lock size={11} aria-label="Locked" />}{locked[mi] === "proven" && <Check size={11} aria-label="Module proven" className="text-[#17784a]" />}{m.title}</p>
          <ul className="mt-1 flex flex-col">
            {m.lessons.map((l) => {
              const on = l.key === current;
              if (locked[mi] === "locked") return <li key={l.key} className="px-2 py-1.5 text-[14px] leading-snug text-[var(--m-muted)]">{l.title}</li>;
              return (
                <li key={l.key}>
                  <Link href={`/skillstudio/courses/${track.key}/${l.key}`} aria-current={on ? "page" : undefined}
                    className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[14px] leading-snug ${on ? "bg-[var(--m-ink)] font-bold text-white" : "text-[var(--m-ink)] hover:bg-[var(--m-ground)]"}`}>
                    <span>{l.title}</span>
                    {done[l.key] ? <Check size={14} aria-label="Done" className={on ? "text-white" : "text-[#17784a]"} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Beside the lesson on wide screens, and a fold-out "All lessons" above it on small ones. */
export function LessonSidebar(props: { track: Track; current: string; done: Record<string, unknown>; locked: readonly ModuleStatus[] }) {
  const total = props.track.modules.reduce((n, m) => n + m.lessons.length, 0);
  const finished = props.track.modules.reduce((n, m) => n + m.lessons.filter((l) => props.done[l.key]).length, 0);
  return (
    <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
      <details className="rounded-xl border border-[var(--m-rule)] bg-white lg:hidden">
        <summary className="cursor-pointer px-4 py-3 text-[14px] font-bold text-[var(--m-ink)]">All lessons · {finished}/{total} done</summary>
        <div className="border-t border-[var(--m-rule)] p-3"><Chapters {...props} /></div>
      </details>
      <div className="hidden rounded-xl border border-[var(--m-rule)] bg-white p-3 lg:block">
        <p className="px-2 pb-2 text-[13px] font-bold text-[var(--m-ink)]">{props.track.title} · {finished}/{total} done</p>
        <Chapters {...props} />
      </div>
    </aside>
  );
}
