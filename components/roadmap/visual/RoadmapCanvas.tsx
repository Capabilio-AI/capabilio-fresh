"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphNode, RoadmapGraph } from "@/lib/roadmap-visual/graph-types";
import { COVERAGE_LABEL, STAGE_LABEL, STATUS_META } from "./meta";
import { StationMark } from "./StationMark";

export interface CanvasHandlers {
  selected: string | null;
  onSelect: (key: string) => void;
  matches: ReadonlySet<string> | null;
}

const INK = "#0b1b33";
/** One line colour per domain group; each holds 4.5:1 against white so the badge text reads. */
const LINES = ["#d4202c", "#0b5cad", "#0d7a45", "#b45309", "#7a3e9d", "#007f86", "#c2185b", "#8b5a2b"];
const MARK = 22;
const INSET = 14;

type Pt = [number, number];

/** A 45-degree route, as on a transit diagram: straight, a diagonal, straight. */
function route(a: Pt, b: Pt): string {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  if (dy < 1 || dx < dy) return `M${x1},${y1} L${x2},${y2}`;
  const s = x2 > x1 ? 1 : -1;
  const h = (dx - dy) / 2;
  return `M${x1},${y1} H${x1 + s * h} L${x1 + s * (h + dy)},${y2} H${x2}`;
}

/** The first topic you can act on: what you are learning, then what is below target, then what has not been measured. */
function nextStop(nodes: GraphNode[]): string | null {
  const open = nodes.filter((n) => n.type === "TOPIC" && !n.resource && n.status !== "LOCKED" && n.status !== "SKIPPED" && n.status !== "TARGET_MET").sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const pick = (...s: GraphNode["status"][]) => open.find((n) => s.includes(n.status));
  return (pick("LEARNING") ?? pick("NEEDS_CHECK", "NOT_STARTED") ?? pick("NOT_ASSESSED"))?.key ?? null;
}

function Station({ n, color, h, next }: { n: GraphNode; color: string; h: CanvasHandlers; next: boolean }) {
  const meta = STATUS_META[n.status];
  const kind = n.resource ? (n.resource.kind === "PROJECT" ? "PROJECT" : "CERTIFICATION") : null;
  const left = n.side === "LEFT";
  const dim = h.matches && !h.matches.has(n.key);
  const sel = h.selected === n.key;
  return (
    <button
      type="button"
      onClick={() => h.onSelect(n.key)}
      aria-pressed={sel}
      aria-label={`${n.title}. ${kind ? (kind === "PROJECT" ? "Project" : "Certification") : meta.label}${n.level !== null ? `, level ${n.level}` : ""}${next ? ". Your next stop" : ""}${n.coverage ? `. ${COVERAGE_LABEL[n.coverage.state]}` : ""}`}
      style={{ left: n.box.x, top: n.box.y, width: n.box.w, height: n.box.h, opacity: dim ? 0.25 : 1 }}
      className={`metro-node absolute flex items-center gap-2.5 rounded-lg px-2 text-[14px] font-bold leading-tight ${left ? "flex-row-reverse text-right" : "text-left"} ${sel ? "bg-white shadow-[0_0_0_2.5px_#0b1b33]" : "hover:bg-white/80"} ${n.status === "LOCKED" || n.status === "SKIPPED" ? "text-[var(--m-muted)]" : "text-[var(--m-ink)]"} ${n.status === "SKIPPED" ? "line-through" : ""}`}
    >
      <StationMark status={n.status} color={color} resource={kind} size={MARK} next={next} />
      <span className="metro-label min-w-0 flex-1 line-clamp-2 break-words">{n.title}</span>
      {next && <span className="shrink-0 rounded bg-[var(--m-ink)] px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">Next</span>}
      {n.coverage && (n.coverage.state === "STRONG" || n.coverage.state === "PARTIAL") && <span aria-hidden title={COVERAGE_LABEL[n.coverage.state]} className="shrink-0 font-mono text-[10px] tracking-tighter text-[var(--m-accent-ink)]">{n.coverage.state === "STRONG" ? "●●" : "●○"}</span>}
    </button>
  );
}

/** The whole roadmap as a line map: stages are interchanges on the trunk, each domain is a coloured line, each topic a station on it. */
export function RoadmapCanvas({ graph, handlers, caption, countLabel = "assessed", label = "Career roadmap as a line map" }: { graph: Pick<RoadmapGraph, "nodes" | "edges" | "bounds">; handlers: CanvasHandlers; caption?: (n: GraphNode) => string; countLabel?: string; label?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { bounds } = graph;
  useEffect(() => {
    const el = wrap.current;
    if (!el || bounds.w === 0) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 24) / (bounds.w + 24)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bounds.w]);

  const pad = 12;
  const W = bounds.w + pad * 2;
  const H = bounds.h + pad * 2;
  const { moved, byKey, colorOf, next } = useMemo(() => {
    const m = graph.nodes.map((n) => ({ ...n, box: { ...n.box, x: n.box.x - bounds.x + pad, y: n.box.y + pad } }));
    const groups = m.filter((n) => n.type === "GROUP").sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
    const line = new Map(groups.map((g, i) => [g.key, LINES[i % LINES.length]]));
    return { moved: m, byKey: new Map(m.map((n) => [n.key, n])), colorOf: (n: GraphNode) => (n.type === "GROUP" ? line.get(n.key) : n.parentKey ? line.get(n.parentKey) : undefined) ?? INK, next: nextStop(m) };
  }, [graph.nodes, bounds.x]);

  const paths = graph.edges.flatMap((e) => {
    const a = byKey.get(e.from);
    const b = byKey.get(e.to);
    if (!a || !b) return [];
    const A = a.box;
    const B = b.box;
    if (e.kind === "SPINE_NEXT") return [<line key={e.id} x1={A.x + A.w / 2} y1={A.y + A.h} x2={B.x + B.w / 2} y2={B.y} stroke={INK} strokeWidth={10} strokeLinecap="round" />];
    const left = b.side === "LEFT";
    const from: Pt = [left ? A.x : A.x + A.w, A.y + A.h / 2];
    const to: Pt = e.kind === "GROUP_TOPIC" ? [left ? B.x + B.w - INSET : B.x + INSET, B.y + B.h / 2] : [left ? B.x + B.w : B.x, B.y + B.h / 2];
    const dim = handlers.matches && e.kind === "GROUP_TOPIC" && !handlers.matches.has(e.to);
    return [<path key={e.id} d={route(from, to)} fill="none" stroke={colorOf(b)} strokeWidth={e.kind === "SPINE_GROUP" ? 8 : 6} strokeLinecap="round" strokeLinejoin="round" opacity={dim ? 0.2 : 1} />];
  });

  return (
    <div ref={wrap} className="w-full overflow-x-hidden rounded-xl border border-[var(--m-rule)] bg-white py-4" role="region" aria-label={`${label}. Tab moves between stations; Enter opens one.`}>
      <div className="mx-auto" style={{ width: W * scale, height: H * scale }}>
        <div className="relative" style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <svg width={W} height={H} className="absolute left-0 top-0" aria-hidden>{paths}</svg>
          {moved.map((n) => {
            if (n.type === "TOPIC") return <Station key={n.key} n={n} color={colorOf(n)} h={handlers} next={n.key === next} />;
            const spine = n.type === "SPINE";
            const sel = handlers.selected === n.key;
            const style = { left: n.box.x, top: n.box.y, width: n.box.w, height: n.box.h };
            return spine ? (
              <button key={n.key} type="button" style={style} onClick={() => handlers.onSelect(n.key)} aria-pressed={sel} className={`absolute flex flex-col items-center justify-center rounded-xl border-[4px] border-[var(--m-ink)] bg-white px-3 text-center ${sel ? "shadow-[0_0_0_3px_#0b5cad]" : ""}`}>
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{STAGE_LABEL[n.stage]}</span>
                <span className="line-clamp-2 text-[16px] font-bold leading-tight text-[var(--m-ink)]">{n.title}</span>
                {n.topics > 0 && <span className="font-mono text-[10.5px] text-[var(--m-muted)]">{n.assessedTopics}/{n.topics} {countLabel}</span>}
              </button>
            ) : (
              <button key={n.key} type="button" style={style} onClick={() => handlers.onSelect(n.key)} aria-pressed={sel} className={`absolute flex flex-col justify-center rounded-2xl px-4 text-center text-white ${sel ? "shadow-[0_0_0_3px_#0b1b33]" : ""}`}>
                <span style={{ background: colorOf(n) }} className="absolute inset-0 -z-0 rounded-2xl" />
                <span className="relative line-clamp-2 text-[14.5px] font-bold leading-tight">{n.title}</span>
                {n.topics > 0 && <span className="relative font-mono text-[10.5px] opacity-90">{n.assessedTopics}/{n.topics} {countLabel}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
