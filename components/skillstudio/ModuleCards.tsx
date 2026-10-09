import Link from "next/link";
import { ArrowRight, BookOpen, FolderKanban, Swords } from "lucide-react";
import type { LearningModule, ModulesView } from "@/lib/skillstudio/modules";
import { STAGE_LABEL } from "@/components/roadmap/visual/meta";
import { StationMark } from "@/components/roadmap/visual/StationMark";

const COLORS = ["#b3265b", "#0b5cad", "#0d7a45", "#b45309", "#7a3e9d", "#007f86", "#d4202c", "#8b5a2b"];

function topicState(level: number | null, target: number | null) {
  return level === null ? "NOT_ASSESSED" : target !== null && level >= target ? "TARGET_MET" : level > 0 ? "LEARNING" : "NOT_STARTED";
}

function ModuleCard({ m, color }: { m: LearningModule; color: string }) {
  const pct = m.progress ?? 0;
  const href = (key: string) => `/dashboard/roadmap?node=${encodeURIComponent(key)}`;
  return (
    <li className="flex flex-col rounded-2xl border border-[var(--m-rule)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]">
            {STAGE_LABEL[m.stage]}
            {m.focus && <span className="rounded bg-[var(--m-ink)] px-1.5 py-0.5 text-[10.5px] text-white">Learn now</span>}
          </p>
          <h3 className="mt-1 font-lp-display text-[19px] font-bold leading-snug text-[var(--m-ink)]">{m.title}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-lp-display text-[22px] font-bold leading-none text-[var(--m-ink)]">{m.progress === null ? "–" : `${Math.round(pct)}%`}</p>
          <p className="mt-0.5 text-[11px] text-app-muted">{m.assessed}/{m.topics.length} measured</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${m.title}: ${m.progress === null ? "not measured yet" : `${Math.round(pct)} percent`}`}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      {m.description && <p className="mt-3 line-clamp-2 text-[13px] leading-snug text-app-muted">{m.description}</p>}
      <ul className="mt-4 flex flex-col gap-1">
        {m.topics.map((t) => (
          <li key={t.key}>
            <Link href={href(t.key)} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--m-ground)]">
              <StationMark status={topicState(t.level, t.target)} color={color} size={18} />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-[var(--m-ink)]">{t.title}</span>
              <span className="shrink-0 text-[12px] text-app-muted">{t.level === null ? "Not assessed" : `${t.level}%`}{t.target !== null ? ` / ${t.target}%` : ""}</span>
              <ArrowRight size={13} aria-hidden className="shrink-0 text-[var(--m-muted)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-4 text-[12px] text-app-muted">
        {m.practice.learning > 0 && <span className="flex items-center gap-1.5"><BookOpen size={13} aria-hidden />{m.practice.learning} learning {m.practice.learning === 1 ? "resource" : "resources"}</span>}
        {m.practice.arena > 0 && <span className="flex items-center gap-1.5"><Swords size={13} aria-hidden />{m.practice.arena} Arena {m.practice.arena === 1 ? "challenge" : "challenges"}</span>}
        {m.practice.projects > 0 && <span className="flex items-center gap-1.5"><FolderKanban size={13} aria-hidden />{m.practice.projects} {m.practice.projects === 1 ? "project" : "projects"}</span>}
      </div>
    </li>
  );
}

/** The student's career as learning modules: each card is a roadmap module; a topic opens its learning resources on the roadmap. */
export function ModuleCards({ view }: { view: ModulesView }) {
  const now = view.modules.filter((m) => m.focus).length;
  return (
    <section aria-labelledby="modules-h" className="flex flex-col gap-4">
      <div>
        <h2 id="modules-h" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">Your {view.careerName} modules</h2>
        <p className="mt-1 max-w-[70ch] text-[13.5px] text-app-muted">{now} {now === 1 ? "module is" : "modules are"} what to learn at your stage. Pick a topic to open its learning resources, then prove it in Arena.</p>
      </div>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {view.modules.map((m, i) => <ModuleCard key={m.key} m={m} color={COLORS[i % COLORS.length]} />)}
      </ul>
    </section>
  );
}
