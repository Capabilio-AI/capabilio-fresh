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
import { SyllabusMap } from "./SyllabusMap";
import { SubjectsPanel } from "./SubjectsPanel";
import { SubjectsTree } from "./SubjectsTree";
import { Drawer } from "@/components/metro/Drawer";
import { STATUS_META } from "./meta";
import { StationMark } from "./StationMark";
import "@/components/metro/metro.css";
import { useRoadmapGraph, type CareerSlot } from "./useRoadmapGraph";

type View = "map" | "list";
type Section = "career" | "curriculum";
type CurriculumView = "tree" | "timetable";
type Filter = "all" | "attention" | "unassessed" | "done" | "syllabus";
const FILTERS: { id: Filter; label: string }[] = [{ id: "all", label: "All topics" }, { id: "attention", label: "Needs attention" }, { id: "unassessed", label: "Not assessed" }, { id: "done", label: "Proven (target met)" }, { id: "syllabus", label: "In my syllabus" }];

const matchesFilter = (n: GraphNode, f: Filter) =>
  f === "all" || (f === "attention" ? ["NOT_STARTED", "NEEDS_CHECK", "LEARNING"].includes(n.status) : f === "unassessed" ? n.status === "NOT_ASSESSED" : f === "done" ? n.status === "TARGET_MET" : (n.coverage?.courses ?? 0) > 0);

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
  const section: Section = params.get("section") === "curriculum" ? "curriculum" : "career";
  const [curriculumView, setCurriculumView] = useState<CurriculumView>("tree");

  const update = useCallback((change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    change(next);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router]);
  const select = useCallback((key: string | null) => update((n) => (key ? n.set("node", key) : n.delete("node"))), [update]);
  const setSection = useCallback((sec: Section) => update((n) => (sec === "curriculum" ? n.set("section", "curriculum") : n.delete("section"))), [update]);

  const graph = data.ok ? data.graph : null;
  const matches = useMemo(() => {
    if (!graph || (!query.trim() && filter === "all")) return null;
    const q = query.trim().toLowerCase();
    return new Set(graph.nodes.filter((n) => n.type === "TOPIC" && matchesFilter(n, filter) && (!q || n.title.toLowerCase().includes(q) || n.skill?.name.toLowerCase().includes(q))).map((n) => n.key));
  }, [graph, query, filter]);

  const handlers = useMemo<CanvasHandlers>(() => ({ selected, onSelect: select, matches }), [selected, select, matches]);

  if (!data.ok) return <div><RoadmapEmpty reason={data.reason} which={which} onReady={() => void refresh()} /></div>;
  const g = data.graph;
  const counts = g.nodes.filter((n) => n.type === "TOPIC").reduce<Record<string, number>>((a, n) => ({ ...a, [n.status]: (a[n.status] ?? 0) + 1 }), {});
  const open = selected && g.nodes.some((n) => n.key === selected) ? selected : null;
  const openNode = g.nodes.find((n) => n.key === open) ?? null;
  const hasSubjects = Boolean(g.syllabus && g.syllabus.some((x) => x.topics.length > 0));
  const tab = (v: View, label: string) => (
    <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 font-lp-body text-[12.5px] ${view === v ? "bg-[var(--m-ink)] font-bold text-white" : "text-[var(--m-ink)] hover:bg-[var(--m-ground)]"}`}>{label}</button>
  );

  return (
    <div className="space-y-4">
      <RoadmapHeader graph={g} generatedAt={data.generatedAt} which={data.which} planB={data.planB} onWhich={(w) => { select(null); setWhich(w); }} onRefresh={() => void refresh()} loading={loading} stale={stale} onChanged={() => void refresh()} />

      <WhatChanged nodes={g.nodes} storageKey={`roadmap-memo:${g.career.id}`} onOpen={select} />

      {g.header.assessedTopics < g.header.totalTopics && <CheckBanner career={data.which} assessedTopics={g.header.assessedTopics} />}

      <SectionSwitch section={section} onChange={setSection} />

      {section === "career" ? (
        <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="View" className="flex gap-1 rounded-lg border border-app-border bg-white p-1">{[tab("map", "Career map"), tab("list", "List")]}</div>
          <label className="sr-only" htmlFor="rm-search">Search topics</label>
          <input id="rm-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics" className="min-w-0 flex-1 rounded-md border border-app-border bg-white px-3 py-1.5 font-lp-body text-[13px] sm:max-w-xs" />
          <label className="sr-only" htmlFor="rm-filter">Filter topics</label>
          <select id="rm-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="rounded-md border border-app-border bg-white px-2 py-1.5 font-lp-body text-[13px]">{FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
          {matches && <p role="status" className="font-lp-body text-[12px] text-app-muted">{matches.size === 0 && filter === "syllabus" && g.header.curriculum.analysed === false ? "Your syllabus is still being analysed, so nothing is matched yet." : `${matches.size} matching`}</p>}
        </div>

        <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-lp-body text-[12px] text-app-muted">
          {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).filter((s) => counts[s]).map((s) => <li key={s} className="flex items-center gap-1.5"><StationMark status={s} size={16} /> {STATUS_META[s].label} ({counts[s]})</li>)}
          <li><span aria-hidden className="font-mono">●● ●○</span> syllabus coverage (strong / partial)</li>
        </ul>

        <div className="min-w-0">
          {view === "map" && (
            <>
              <div className="hidden lg:block"><RoadmapCanvas graph={g} handlers={handlers} /></div>
              <div className="lg:hidden"><ListView nodes={g.nodes} selected={open} onSelect={select} matches={matches} /></div>
            </>
          )}
          {view === "list" && <ListView nodes={g.nodes} selected={open} onSelect={select} matches={matches} />}
        </div>
        </div>
      ) : (
        <div className="space-y-4">
          {hasSubjects ? (
            <>
              <div role="tablist" aria-label="Curriculum view" className="flex w-fit gap-1 rounded-lg border border-[var(--m-rule)] bg-white p-1">
                {(["tree", "timetable"] as const).map((v) => (
                  <button key={v} type="button" role="tab" aria-selected={curriculumView === v} onClick={() => setCurriculumView(v)} className={`rounded-md px-3 py-1.5 font-lp-body text-[12.5px] ${curriculumView === v ? "bg-[var(--m-ink)] font-bold text-white" : "text-[var(--m-ink)] hover:bg-[var(--m-ground)]"}`}>{v === "tree" ? "Subject tree" : "Semester timetable"}</button>
                ))}
              </div>
              {curriculumView === "tree" ? (
                <>
                  <SubjectsTree syllabus={g.syllabus!} careerName={g.career.name} onOpenTopic={select} />
                  <div className="lg:hidden"><SyllabusMap syllabus={g.syllabus!} careerName={g.career.name} onOpenTopic={select} /></div>
                </>
              ) : (
                <SyllabusMap syllabus={g.syllabus!} careerName={g.career.name} onOpenTopic={select} />
              )}
            </>
          ) : (
            <SubjectsPanel subjects={g.subjects} state={g.header.curriculum.state} />
          )}
        </div>
      )}
      {open && (
        <Drawer onClose={() => select(null)}>
          <div className="flex h-full flex-col">
            {section === "curriculum" && !openNode?.resource && (
              <button type="button" onClick={() => setSection("career")} className="flex shrink-0 items-center justify-between gap-3 bg-[var(--m-ground)] px-5 py-2.5 text-left font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline">
                Show this topic on the career roadmap <span aria-hidden>→</span>
              </button>
            )}
            <div className="min-h-0 flex-1">
              {openNode?.resource ? (
                <ExtraPanel key={openNode.key} resource={openNode.resource} career={data.which} onClose={() => select(null)} />
              ) : (
                <TopicPanel key={`${data.which}:${open}`} nodeKey={open} career={data.which} careerId={g.career.id} onClose={() => select(null)} onChanged={() => void refresh()} onSelect={select} />
              )}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

/** The two roadmaps: where the career needs you to get, and what to focus on in your degree to get there. */
function SectionSwitch({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  const items: { id: Section; title: string; hint: string }[] = [
    { id: "career", title: "Career roadmap", hint: "What the role needs" },
    { id: "curriculum", title: "Curriculum roadmap", hint: "What to focus on in your degree" },
  ];
  return (
    <div role="tablist" aria-label="Roadmap section" className="glass flex w-full max-w-[640px] gap-1 rounded-3xl p-1.5">
      {items.map((it) => {
        const on = section === it.id;
        return (
          <button key={it.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(it.id)} className={`min-w-0 flex-1 rounded-[1.25rem] px-4 py-2.5 text-left transition-[background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none ${on ? "glass-thumb" : "hover:bg-white/55"}`}>
            <span className={`block font-lp-display text-[17px] font-bold leading-tight ${on ? "text-[var(--m-ink)]" : "text-[var(--m-muted)]"}`}>{it.title}</span>
            <span className="block truncate text-[12.5px] text-[var(--m-muted)]">{it.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
