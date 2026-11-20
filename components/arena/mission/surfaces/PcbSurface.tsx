"use client";

import { useMemo, useRef, useState } from "react";
import { centre, overlaps, type Box, type Pin } from "@/lib/arena-challenges/missions/sim/pcb";
import type { Outcome, Settings } from "@/lib/arena-challenges/missions/types";

interface PartDef { id: string; label: string; w: number; h: number; options?: string[] }
interface PcbData {
  cols: number;
  rows: number;
  mcu: Box;
  connector: Box;
  keepouts: Box[];
  pins: { vdd: Pin; oscA: Pin; oscB: Pin; power: Pin };
  parts: PartDef[];
  limits: { dec: number; xtal: number; cl: number; bulk: number; reg: number; heat: number };
}
interface Props { data: unknown; settings: Settings; setSettings: (s: Settings) => void; disabled: boolean; outcome: Outcome | null }
type Placed = Record<string, [number, number, number]>;

const CELL = 20;
const TINT: Record<string, string> = { cdec: "#e6d3a8", y1: "#b9d8d3", cl1: "#e6d3a8", cl2: "#e6d3a8", u2: "#e3b7b0", cin: "#dcc7e8", cout: "#dcc7e8", led: "#f3c969", rled: "#cfd8c4" };

function read(raw: unknown): Placed {
  try {
    const p = (JSON.parse(String(raw || "{}")) as { p?: Placed }).p;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

/** The PCB canvas: drag parts from the tray onto the board. Rings show how close a part must be; dashed lines show what each part must connect to. */
export function PcbSurface({ data, settings, setSettings, disabled, outcome }: Props) {
  const d = data as PcbData;
  const placed = useMemo(() => read(settings.design), [settings.design]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; ox: number; oy: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const failing = new Set((outcome?.overlay as { failing?: string[] } | undefined)?.failing ?? []);

  const def = (id: string) => d.parts.find((p) => p.id === id)!;
  const pos = (id: string) => (drag?.id === id ? { x: drag.x, y: drag.y } : { x: placed[id][0], y: placed[id][1] });
  const box = (id: string): Box => ({ ...pos(id), w: def(id).w, h: def(id).h });
  const write = (next: Placed) => setSettings({ ...settings, design: Object.keys(next).length ? JSON.stringify({ p: next }) : "" });
  const clamp = (id: string, x: number, y: number) => ({ x: Math.max(0, Math.min(d.cols - def(id).w, x)), y: Math.max(0, Math.min(d.rows - def(id).h, y)) });
  const fixed: Box[] = [d.mcu, d.connector, ...d.keepouts];
  const ids = Object.keys(placed).filter((id) => d.parts.some((p) => p.id === id));

  const overlapping = new Set<string>();
  ids.forEach((a) => {
    if (fixed.some((f) => overlaps(box(a), f))) overlapping.add(a);
    ids.forEach((b) => { if (a !== b && overlaps(box(a), box(b))) overlapping.add(a); });
  });

  const cellAt = (e: React.PointerEvent): { x: number; y: number } => {
    const el = svg.current!;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse());
    return { x: p.x / CELL, y: p.y / CELL };
  };
  const down = (e: React.PointerEvent, id: string) => {
    if (disabled) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const c = cellAt(e);
    setSelected(id);
    setDrag({ id, x: placed[id][0], y: placed[id][1], ox: c.x - placed[id][0], oy: c.y - placed[id][1] });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const c = cellAt(e);
    setDrag({ ...drag, ...clamp(drag.id, Math.round(c.x - drag.ox), Math.round(c.y - drag.oy)) });
  };
  const up = () => {
    if (!drag) return;
    write({ ...placed, [drag.id]: [drag.x, drag.y, placed[drag.id][2]] });
    setDrag(null);
  };
  const nudge = (id: string, dx: number, dy: number) => {
    const p = clamp(id, placed[id][0] + dx, placed[id][1] + dy);
    write({ ...placed, [id]: [p.x, p.y, placed[id][2]] });
  };
  const addPart = (id: string) => {
    const others = ids.map(box);
    for (let y = d.rows - def(id).h; y >= 0; y--) {
      for (let x = 0; x + def(id).w <= d.cols; x++) {
        const b: Box = { x, y, w: def(id).w, h: def(id).h };
        if (![...fixed, ...others].some((o) => overlaps(b, o))) { write({ ...placed, [id]: [x, y, 0] }); setSelected(id); return; }
      }
    }
  };
  const remove = (id: string) => { const { [id]: _gone, ...rest } = placed; void _gone; write(rest); setSelected(null); };

  const oscMid: Pin = { x: d.pins.oscA.x, y: (d.pins.oscA.y + d.pins.oscB.y) / 2 };
  const has = (id: string) => id in placed;
  const regPin = (side: "in" | "out"): Pin | null => (has("u2") ? { x: box("u2").x + (side === "in" ? 0 : 4), y: box("u2").y + 1.5 } : null);
  const nets: [Pin | null, Pin | null][] = [
    [has("cdec") ? centre(box("cdec")) : null, d.pins.vdd],
    [has("y1") ? centre(box("y1")) : null, oscMid],
    [has("cl1") && has("y1") ? centre(box("cl1")) : null, has("y1") ? centre(box("y1")) : null],
    [has("cl2") && has("y1") ? centre(box("cl2")) : null, has("y1") ? centre(box("y1")) : null],
    [has("u2") ? centre(box("u2")) : null, d.pins.power],
    [has("cin") ? centre(box("cin")) : null, regPin("in")],
    [has("cout") ? centre(box("cout")) : null, regPin("out")],
  ];
  const ring = (id: string | null): { at: Pin; r: number } | null => {
    if (!id) return null;
    const l = d.limits;
    if (id === "cdec") return { at: d.pins.vdd, r: l.dec };
    if (id === "y1") return { at: oscMid, r: l.xtal };
    if ((id === "cl1" || id === "cl2") && has("y1")) return { at: centre(box("y1")), r: l.cl };
    if (id === "u2") return { at: d.pins.power, r: l.reg };
    if (id === "cin" && regPin("in")) return { at: regPin("in")!, r: l.bulk };
    if (id === "cout" && regPin("out")) return { at: regPin("out")!, r: l.bulk };
    return null;
  };
  const r = ring(selected);
  const unplaced = d.parts.filter((p) => !has(p.id));
  const sel = selected && has(selected) ? def(selected) : null;
  const valueText = (id: string) => def(id).options?.[placed[id][2]] ?? "";
  const px = (v: number) => v * CELL;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <svg ref={svg} viewBox={`0 0 ${d.cols * CELL} ${d.rows * CELL}`} className="w-full touch-none select-none rounded-lg border border-[var(--m-rule)] bg-[#1f5a45]" onPointerMove={move} onPointerUp={up} onPointerLeave={up} role="group" aria-label="PCB board">
        <defs>
          <pattern id="pcb-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse"><path d={`M${CELL} 0H0V${CELL}`} fill="none" stroke="#ffffff" strokeOpacity={0.09} /></pattern>
          <pattern id="pcb-hatch" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1={0} y1={0} x2={0} y2={8} stroke="#e8b04a" strokeWidth={3} /></pattern>
        </defs>
        <rect width={d.cols * CELL} height={d.rows * CELL} fill="url(#pcb-grid)" />
        {d.keepouts.map((k, i) => <g key={i}><rect x={px(k.x)} y={px(k.y)} width={px(k.w)} height={px(k.h)} fill="url(#pcb-hatch)" opacity={0.5} /><text x={px(k.x + k.w / 2)} y={px(k.y + k.h / 2) + 4} textAnchor="middle" fontSize={10} fill="#fff">keep-out</text></g>)}
        <rect x={px(d.connector.x)} y={px(d.connector.y)} width={px(d.connector.w)} height={px(d.connector.h)} fill="#3b3b3b" stroke="#bbb" />
        <text x={px(d.connector.x + 1.5)} y={px(d.connector.y + 3)} textAnchor="middle" fontSize={10} fill="#fff">J1 PWR</text>
        <rect x={px(d.mcu.x)} y={px(d.mcu.y)} width={px(d.mcu.w)} height={px(d.mcu.h)} fill="#26262b" stroke="#bbb" />
        <text x={px(d.mcu.x + 3)} y={px(d.mcu.y + 3) + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">MCU</text>
        {nets.map(([a, b], i) => a && b && <line key={i} x1={px(a.x)} y1={px(a.y)} x2={px(b.x)} y2={px(b.y)} stroke="#f7e08a" strokeWidth={1.3} strokeDasharray="3 3" opacity={0.85} />)}
        {r && <circle cx={px(r.at.x)} cy={px(r.at.y)} r={px(r.r)} fill="#f7e08a" fillOpacity={0.1} stroke="#f7e08a" strokeDasharray="5 4" />}
        <circle cx={px(d.pins.vdd.x)} cy={px(d.pins.vdd.y)} r={4} fill="#ef4444" /><text x={px(d.pins.vdd.x) - 6} y={px(d.pins.vdd.y) - 7} textAnchor="end" fontSize={9} fill="#fff">VDD</text>
        <circle cx={px(d.pins.oscA.x)} cy={px(d.pins.oscA.y)} r={4} fill="#60a5fa" /><circle cx={px(d.pins.oscB.x)} cy={px(d.pins.oscB.y)} r={4} fill="#60a5fa" /><text x={px(d.pins.oscA.x) + 7} y={px(d.pins.oscA.y) - 6} fontSize={9} fill="#fff">OSC</text>
        <circle cx={px(d.pins.power.x)} cy={px(d.pins.power.y)} r={4} fill="#ef4444" />
        {ids.map((id) => {
          const b = box(id);
          const bad = failing.has(id) || overlapping.has(id);
          return (
            <g key={id} tabIndex={disabled ? -1 : 0} role="button" aria-label={`${def(id).label}${valueText(id) ? ` ${valueText(id)}` : ""}`} className={disabled ? "" : "cursor-grab"} onPointerDown={(e) => down(e, id)} onFocus={() => setSelected(id)}
              onKeyDown={(e) => { const k: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; if (k[e.key] && !disabled) { e.preventDefault(); nudge(id, ...k[e.key]); } }}>
              <rect x={px(b.x)} y={px(b.y)} width={px(b.w)} height={px(b.h)} rx={3} fill={TINT[id] ?? "#ddd"} stroke={bad ? "#ef4444" : selected === id ? "#fff" : "#2b2b2b"} strokeWidth={bad || selected === id ? 3 : 1.4} />
              <text x={px(b.x + b.w / 2)} y={px(b.y + b.h / 2) + 3.5} textAnchor="middle" fontSize={b.w >= 3 ? 10 : 8.5} fontWeight={700} fill="#1c1c1c" pointerEvents="none">{id === "u2" ? "REG" : id === "y1" ? "XTAL" : id === "led" ? "LED" : valueText(id).replace(" ", "")}</text>
            </g>
          );
        })}
      </svg>
      <div className="space-y-3">
        <div>
          <p className="font-lp-body text-[12.5px] font-semibold text-app-muted">Parts tray {unplaced.length === 0 ? "(all placed)" : ""}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unplaced.map((p) => <button key={p.id} type="button" disabled={disabled} onClick={() => addPart(p.id)} className="rounded-md border border-[var(--m-rule)] bg-white px-2.5 py-1.5 font-lp-body text-[12px] text-[var(--m-ink)] hover:border-[var(--m-ink)] disabled:opacity-50">+ {p.label}</button>)}
          </div>
        </div>
        {sel && selected && (
          <div className="rounded-lg border border-[var(--m-rule)] bg-white p-3">
            <p className="font-lp-body text-[12.5px] font-bold text-[var(--m-ink)]">{sel.label}</p>
            {sel.options && (
              <label className="mt-2 block font-lp-body text-[11.5px] text-app-muted">Value
                <select value={placed[selected][2]} disabled={disabled} onChange={(e) => write({ ...placed, [selected]: [placed[selected][0], placed[selected][1], Number(e.target.value)] })} className="mt-1 w-full rounded-md border border-[var(--m-rule)] bg-white px-2 py-1.5 font-lp-mono text-[12.5px] text-[var(--m-ink)]">
                  {sel.options.map((o, i) => <option key={o} value={i}>{o}</option>)}
                </select>
              </label>
            )}
            <div className="mt-2 flex items-center gap-1">
              {([["←", -1, 0], ["↑", 0, -1], ["↓", 0, 1], ["→", 1, 0]] as const).map(([t, dx, dy]) => <button key={t} type="button" disabled={disabled} onClick={() => nudge(selected, dx, dy)} aria-label={`Move ${t}`} className="h-7 w-7 rounded-md border border-[var(--m-rule)] font-lp-mono text-[13px] text-[var(--m-ink)] disabled:opacity-50">{t}</button>)}
              <button type="button" disabled={disabled} onClick={() => remove(selected)} className="ml-auto font-lp-body text-[12px] font-semibold text-app-rose disabled:opacity-50">Remove</button>
            </div>
          </div>
        )}
        <p className="font-lp-body text-[11.5px] leading-relaxed text-app-muted">Drag parts, or select one and use the arrow keys. The dashed ring shows how near a part must be; yellow dashed lines are the connections it needs. Red outline means overlap{outcome ? " or a failed rule" : ""}.</p>
      </div>
    </div>
  );
}
