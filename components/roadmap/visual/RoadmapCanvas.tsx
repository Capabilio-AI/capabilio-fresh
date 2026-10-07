"use client";

import { useEffect, useRef, useState } from "react";
import type { GraphNode, RoadmapGraph } from "@/lib/roadmap-visual/graph-types";
import { COVERAGE_GLYPH, COVERAGE_LABEL, STATUS_META } from "./meta";

export interface CanvasHandlers {
  selected: string | null;
  onSelect: (key: string) => void;
  matches: ReadonlySet<string> | null;
}

const BLUE = "#2b78e4";

// Bold yellow boxes with a dark outline; status never relies on colour alone (a glyph and label always come with it).
const TOPIC_FILL: Record<GraphNode["status"], string> = {
  NOT_ASSESSED: "bg-[#fde9a8]",
  NOT_STARTED: "bg-[#fde9a8]",
  LEARNING: "bg-[#ffd166]",
  DONE: "bg-[#c8f0c8]",
  TARGET_MET: "bg-[#c8f0c8]",
  SKIPPED: "bg-[#e5e7eb] text-gray-500 line-through",
  NEEDS_CHECK: "bg-[#ffd9b3]",
  LOCKED: "bg-[#eceff3] text-gray-500",
};
const base = "absolute flex items-center rounded-md border-2 border-black text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b78e4]";

function Box({ n, h }: { n: GraphNode; h: CanvasHandlers }) {
  const sel = h.selected === n.key ? " outline outline-[3px] outline-[#2b78e4]" : "";
  const style = { left: n.box.x, top: n.box.y, width: n.box.w, height: n.box.h };
  if (n.type === "SPINE" || n.type === "GROUP") {
    const spine = n.type === "SPINE";
    return (
      <button type="button" style={style} onClick={() => h.onSelect(n.key)} aria-pressed={h.selected === n.key} className={`${base} flex-col justify-center bg-[#fff200] px-3 text-center hover:-translate-y-px ${spine ? "border-[2.5px] shadow-[3px_3px_0_#000]" : "shadow-[2px_2px_0_#000]"}${sel}`}>
        <span className={`${spine ? "text-[16px]" : "text-[15px]"} font-semibold leading-tight`}>{n.title}</span>
        {n.topics > 0 && <span className="text-[10.5px] text-black/70">{n.assessedTopics}/{n.topics} assessed</span>}
      </button>
    );
  }
  const meta = STATUS_META[n.status];
  const dim = h.matches && !h.matches.has(n.key) ? " opacity-25" : "";
  return (
    <button
      type="button"
      style={style}
      onClick={() => h.onSelect(n.key)}
      aria-pressed={h.selected === n.key}
      aria-label={`${n.title}. ${n.resource ? (n.resource.kind === "PROJECT" ? "Project" : "Certification") : meta.label}${n.level !== null ? `, level ${n.level}` : ""}${n.coverage ? `. ${COVERAGE_LABEL[n.coverage.state]}` : ""}`}
      className={`${base} gap-2 px-3 text-left text-[14px] font-medium shadow-[2px_2px_0_#000] transition-transform hover:-translate-y-px ${TOPIC_FILL[n.status]}${sel}${dim}`}
    >
      <span aria-hidden className="w-4 shrink-0 text-center text-[14px]">{n.resource ? (n.resource.kind === "PROJECT" ? "▣" : "★") : meta.glyph}</span>
      <span className="min-w-0 flex-1 truncate">{n.title}</span>
      {n.coverage && (n.coverage.state === "STRONG" || n.coverage.state === "PARTIAL") && <span aria-hidden title={COVERAGE_LABEL[n.coverage.state]} className="shrink-0 text-[10px] tracking-tighter text-[#1d4ed8]">{COVERAGE_GLYPH[n.coverage.state]}</span>}
    </button>
  );
}

/** The whole roadmap at once, top to bottom on the page (no zoom, no panning): boxes placed by the pure layout, joined by SVG lines. */
export function RoadmapCanvas({ graph, handlers }: { graph: RoadmapGraph; handlers: CanvasHandlers }) {
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
  const moved = graph.nodes.map((n) => ({ ...n, box: { ...n.box, x: n.box.x - bounds.x + pad, y: n.box.y + pad } }));
  const byKey = new Map(moved.map((n) => [n.key, n]));
  const paths = graph.edges.flatMap((e) => {
    const a = byKey.get(e.from);
    const b = byKey.get(e.to);
    if (!a || !b) return [];
    const A = a.box;
    const B = b.box;
    if (e.kind === "SPINE_NEXT") return [<line key={e.id} x1={A.x + A.w / 2} y1={A.y + A.h} x2={B.x + B.w / 2} y2={B.y} stroke={BLUE} strokeWidth={3} />];
    const left = b.side === "LEFT";
    const x1 = left ? A.x : A.x + A.w;
    const x2 = left ? B.x + B.w : B.x;
    const y1 = A.y + A.h / 2;
    const y2 = B.y + B.h / 2;
    if (e.kind === "SPINE_GROUP") return [<line key={e.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={BLUE} strokeWidth={3} />];
    const mx = (x1 + x2) / 2;
    return [<path key={e.id} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={BLUE} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" />];
  });

  return (
    <div ref={wrap} className="w-full overflow-x-hidden rounded-xl border border-app-border bg-white py-4" role="region" aria-label="Career roadmap. Tab moves between boxes; Enter opens one.">
      <div className="mx-auto" style={{ width: W * scale, height: H * scale }}>
        <div className="relative" style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <svg width={W} height={H} className="absolute left-0 top-0" aria-hidden>{paths}</svg>
          {moved.map((n) => <Box key={n.key} n={n} h={handlers} />)}
        </div>
      </div>
    </div>
  );
}
