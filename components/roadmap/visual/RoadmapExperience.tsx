"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { GraphResponse } from "@/lib/roadmap-visual/service";
import type { GraphNode } from "@/lib/roadmap-visual/graph-types";
import { RoadmapCanvas, type CanvasHandlers } from "./RoadmapCanvas";
import { ListView } from "./ListView";
import { ExtraPanel } from "./ExtraPanel";
import { TopicPanel } from "./TopicPanel";
import { RoadmapHeader } from "./RoadmapHeader";
import { RoadmapEmpty } from "./EmptyStates";
import { CheckBanner } from "./CheckBanner";
import { WhatChanged } from "./WhatChanged";
import { SubjectsPanel } from "./SubjectsPanel";
import { ProjectsStrip } from "./ProjectsStrip";
import { STATUS_META } from "./meta";
import { useRoadmapGraph, type CareerSlot } from "./useRoadmapGraph";

type View = "map" | "list";
type Filter = "all" | "attention" | "unassessed" | "done" | "syllabus";
const FILTERS: { id: Filter; label: string }[] = [{ id: "all", label: "All topics" }, { id: "attention", label: "Needs attention" }, { id: "unassessed", label: "Not assessed" }, { id: "done", label: "Done / target met" }, { id: "syllabus", label: "In my syllabus" }];

const matchesFilter = (n: GraphNode, f: Filter) =>
  f === "all" || (f === "attention" ? ["NOT_STARTED", "NEEDS_CHECK", "LEARNING"].includes(n.status) : f === "unassessed" ? n.status === "NOT_ASSESSED" : f === "done" ? ["DONE", "TARGET_MET"].includes(n.status) : (n.coverage?.courses ?? 0) > 0);

export function RoadmapExperience({ initial, initialCareer }: { initial: GraphResponse; initialCareer: CareerSlot }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [which, setWhich] = useState<CareerSlot>(initialCareer);
  const { data, stale, loading, refresh } = useRoadmapGraph(initial, which);
  const [view, setView] = useState<View>("map");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const selected = params.get("node");

  const select = useCallback((key: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (key) next.set("node", key); else next.delete("node");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router]);

  const graph = data.ok ? data.graph : null;
  const matches = useMemo(() => {
    if (!graph || (!query.trim() && filter === "all")) return null;
    const q = query.trim().toLowerCase();
    return new Set(graph.nodes.filter((n) => n.type === "TOPIC" && matchesFilter(n, filter) && (!q || n.title.toLowerCase().includes(q) || n.skill?.name.toLowerCase().includes(q))).map((n) => n.key));
  }, [graph, query, filter]);

  const handlers = useMemo<CanvasHandlers>(() => ({ selected, onSelect: select, matches }), [selected, select, matches]);

  if (!data.ok) return <RoadmapEmpty reason={data.reason} />;
  const g = data.graph;
  const counts = g.nodes.filter((n) => n.type === "TOPIC").reduce<Record<string, number>>((a, n) => ({ ...a, [n.status]: (a[n.status] ?? 0) + 1 }), {});
  const open = selected && g.nodes.some((n) => n.key === selected) ? selected : null;
  const openNode = g.nodes.find((n) => n.key === open) ?? null;
  const tab = (v: View, label: string) => (
    <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 font-lp-body text-[12.5px] ${view === v ? "bg-app-charcoal text-white" : "text-app-charcoal hover:bg-app-background"}`}>{label}</button>
  );

  return (
    <div className="space-y-4">
      <RoadmapHeader graph={g} generatedAt={data.generatedAt} which={data.which} planB={data.planB} onWhich={(w) => { select(null); setWhich(w); }} onRefresh={() => void refresh()} loading={loading} stale={stale} onChanged={() => void refresh()} />

      <WhatChanged nodes={g.nodes} storageKey={`roadmap-memo:${g.career.id}`} onOpen={select} />

      {g.header.assessedTopics < g.header.totalTopics && <CheckBanner career={data.which} assessedTopics={g.header.assessedTopics} />}

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="View" className="flex gap-1 rounded-lg border border-app-border bg-white p-1">{[tab("map", "Map"), tab("list", "List")]}</div>
        <label className="sr-only" htmlFor="rm-search">Search topics</label>
        <input id="rm-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics" className="min-w-0 flex-1 rounded-md border border-app-border bg-white px-3 py-1.5 font-lp-body text-[13px] sm:max-w-xs" />
        <label className="sr-only" htmlFor="rm-filter">Filter topics</label>
        <select id="rm-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="rounded-md border border-app-border bg-white px-2 py-1.5 font-lp-body text-[13px]">{FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
        {matches && <p role="status" className="font-lp-body text-[12px] text-app-muted">{matches.size === 0 && filter === "syllabus" && g.header.curriculum.analysed === false ? "Your syllabus is still being analysed, so nothing is matched yet." : `${matches.size} matching`}</p>}
      </div>

      <ul aria-label="Legend" className="flex flex-wrap gap-x-3 gap-y-1 font-lp-body text-[11.5px] text-app-muted">
        {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).filter((s) => counts[s]).map((s) => <li key={s}><span aria-hidden>{STATUS_META[s].glyph}</span> {STATUS_META[s].label} ({counts[s]})</li>)}
        <li><span aria-hidden>●●</span> syllabus coverage (strong / partial)</li>
      </ul>

      <ProjectsStrip nodes={g.nodes} careerName={g.career.name} onOpen={select} />

      <div className="min-w-0">
        {view === "map" && (
          <>
            <div className="hidden lg:block"><RoadmapCanvas graph={g} handlers={handlers} /></div>
            <div className="lg:hidden"><ListView nodes={g.nodes} selected={open} onSelect={select} matches={matches} /></div>
          </>
        )}
        {view === "list" && <ListView nodes={g.nodes} selected={open} onSelect={select} matches={matches} />}
      </div>
      {open && (
        <Drawer onClose={() => select(null)}>
          {openNode?.resource ? (
            <ExtraPanel node={openNode} onClose={() => select(null)} />
          ) : (
            <TopicPanel key={`${data.which}:${open}`} nodeKey={open} career={data.which} careerId={g.career.id} onClose={() => select(null)} onChanged={() => void refresh()} onSelect={select} />
          )}
        </Drawer>
      )}
      <SubjectsPanel subjects={g.subjects} state={g.header.curriculum.state} />
    </div>
  );
}

/** A slide-in popup over the map, like the topic popup of a learning map: dims the page, closes with Escape or a click outside. */
function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Details">
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 cursor-default bg-black/40" />
      <div className="relative h-full w-full max-w-[560px] overflow-hidden bg-white shadow-2xl">{children}</div>
    </div>
  );
}
