"use client";

import type { GraphNode } from "@/lib/roadmap-visual/graph-types";
import { StationMark } from "./StationMark";
import { COVERAGE_LABEL, STAGE_LABEL, STATUS_META } from "./meta";

/** The accessible, mobile-first view of the same roadmap: stages as an accordion, topics as buttons. */
export function ListView({ nodes, selected, onSelect, matches }: { nodes: GraphNode[]; selected: string | null; onSelect: (k: string) => void; matches: ReadonlySet<string> | null }) {
  const stages = nodes.filter((n) => n.type === "SPINE").sort((a, b) => a.box.y - b.box.y);
  const topicsOf = (stage: GraphNode) => nodes.filter((g) => g.parentKey === stage.key && g.type === "GROUP").flatMap((g) => nodes.filter((t) => t.parentKey === g.key).map((t) => ({ t, group: g.title })));
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const items = topicsOf(s).filter(({ t }) => !matches || matches.has(t.key));
        if (matches && items.length === 0) return null;
        return (
          <details key={s.key} open={i === 0 || Boolean(matches) || items.some(({ t }) => t.key === selected)} className="rounded-xl border border-app-border bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-app-muted">{STAGE_LABEL[s.stage]}</span>
              <span className="block font-lp-display text-[15px] font-semibold text-app-charcoal">{s.title}</span>
              <span className="font-lp-body text-[12px] text-app-muted">{s.assessedTopics}/{s.topics} assessed{s.progress !== null ? ` · ${s.progress}% of target` : ""}</span>
            </summary>
            <ul className="space-y-1.5 border-t border-app-border p-3">
              {items.map(({ t, group }) => {
                const m = STATUS_META[t.status];
                const kind = t.resource ? (t.resource.kind === "PROJECT" ? "Project" : "Certification") : null;
                return (
                  <li key={t.key}>
                    <button type="button" onClick={() => onSelect(t.key)} aria-pressed={selected === t.key} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left font-lp-body text-[13px] focus-visible:outline-2 focus-visible:outline-app-blue ${m.box} ${selected === t.key ? "ring-2 ring-app-blue" : ""}`}>
                      <StationMark status={t.status} resource={kind === "Project" ? "PROJECT" : kind ? "CERTIFICATION" : null} size={20} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{t.title}</span>
                        <span className="block text-[11px] text-app-muted">{group} · {kind ?? m.label}{t.level !== null ? ` · ${t.level}/${t.target}` : ""}{t.coverage && t.coverage.state !== "UNKNOWN" ? ` · ${COVERAGE_LABEL[t.coverage.state]}` : ""}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
