import Link from "next/link";
import { Check, ChevronRight, Lock } from "lucide-react";
import clsx from "clsx";
import type { PathModule } from "./types";

/** The little circle that shows where a step or a module stands: done, here, open, or locked. */
function Dot({ state }: { state: "done" | "current" | "open" | "locked" }) {
  if (state === "done") return <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#17784a] text-white"><Check size={12} strokeWidth={3} /></span>;
  if (state === "locked") return <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--m-rule)] text-[var(--m-muted)]"><Lock size={10} /></span>;
  return <span aria-hidden className={clsx("h-5 w-5 shrink-0 rounded-full border-2", state === "current" ? "border-[var(--m-ink)] bg-[var(--m-ink)] shadow-[inset_0_0_0_3px_white]" : "border-[var(--m-rule)]")} />;
}

const moduleLabel = (m: PathModule) => (m.status === "proven" ? "Completed" : m.status === "locked" ? "Locked" : m.current || m.lessons.some((l) => l.state === "done") ? "In progress" : "Not started");

/** The left panel: the course's modules, each with its steps and where the learner stands. A step opens when the one before it is done; a module opens when the one before is proven. */
export function LearningPath({ trackKey, title, tagline, mark, done, total, pct, modules }: { trackKey: string; title: string; tagline: string; mark: string; done: number; total: number; pct: number; modules: PathModule[] }) {
  return (
    <aside aria-label="Learning path" className="rounded-3xl border border-[var(--m-rule)] bg-white p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--m-ink)] font-lp-mono text-[16px] font-bold text-white">{mark}</span>
        <div className="min-w-0"><p className="font-lp-display text-[19px] font-bold leading-tight text-[var(--m-ink)]">{title}</p><p className="text-[13px] leading-snug text-[var(--m-muted)]">{tagline}</p></div>
      </div>
      <p className="ss-num mt-3 text-[12.5px] font-bold text-[var(--m-muted)]">{done}/{total} lessons · {pct}%</p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${pct} percent of lessons done`}><div className="h-full rounded-full bg-[#17784a]" style={{ width: `${pct}%` }} /></div>

      <h2 className="mt-5 flex items-center gap-2 text-[14px] font-bold text-[var(--m-ink)]">Learning path</h2>
      <ol className="mt-2 flex flex-col gap-1.5">
        {modules.map((m) => (
          <li key={m.key}>
            <details open={m.current} className="group rounded-xl">
              <summary className={clsx("flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 [&::-webkit-details-marker]:hidden", m.current ? "bg-[var(--m-ink)] text-white" : "hover:bg-[var(--m-ground)]")}>
                <Dot state={m.status === "proven" ? "done" : m.status === "locked" ? "locked" : m.current ? "current" : "open"} />
                <span className="min-w-0 flex-1"><span className={clsx("block text-[14.5px] font-bold leading-tight", !m.current && "text-[var(--m-ink)]")}>{m.title}</span><span className={clsx("block text-[12px]", m.current ? "text-white/70" : "text-[var(--m-muted)]")}>{moduleLabel(m)}</span></span>
                <ChevronRight size={15} aria-hidden className="shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <ul className="mt-1 flex flex-col gap-0.5 pb-1 pl-5">
                {m.lessons.map((l) => (
                  <li key={l.key}>
                    {l.state === "locked"
                      ? <span className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] leading-snug text-[var(--m-muted)]"><Dot state="locked" />{l.title}</span>
                      : <Link href={`/skillstudio/courses/${trackKey}/${l.key}`} aria-current={l.state === "current" ? "page" : undefined} className={clsx("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] leading-snug hover:bg-[var(--m-ground)]", l.state === "current" ? "bg-[var(--m-ground)] font-bold text-[var(--m-ink)]" : "text-[var(--m-ink)]")}><Dot state={l.state} />{l.title}</Link>}
                  </li>
                ))}
                {m.status !== "locked" && (
                  <li>
                    {m.testReady
                      ? <Link href={`/skillstudio/courses/${trackKey}/module/${m.key}`} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-bold text-[var(--m-accent-ink)] hover:bg-[var(--m-ground)]"><Dot state={m.status === "proven" ? "done" : "open"} />Module test</Link>
                      : <span className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] text-[var(--m-muted)]"><Dot state="locked" />Module test</span>}
                  </li>
                )}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </aside>
  );
}
