"use client";

import { useMemo } from "react";
import type { Outcome, Settings } from "@/lib/arena-challenges/missions/types";

interface NetworkData {
  parent: number[];
  length: number[];
  elev: number[];
  demandLps: number[];
  head: number;
  pMinM: number;
  budget: number;
  sizes: number[];
  costPerM: Record<number, number>;
  vMin: number;
  vMax: number;
}
interface Props { data: unknown; settings: Settings; setSettings: (s: Settings) => void; disabled: boolean; outcome: Outcome | null }

const W = 760;
const ROW = 84;

/** The water network: a reservoir at the left feeding a tree of pipes. Click a pipe to step its diameter up, or choose it from the list. */
export function NetworkSurface({ data, settings, setSettings, disabled, outcome }: Props) {
  const d = data as NetworkData;
  const overlay = outcome?.overlay as { pressure?: number[]; velocity?: number[]; flow?: number[] } | undefined;

  const layout = useMemo(() => {
    const depth = d.parent.map(() => 1);
    d.parent.forEach((p, i) => { depth[i] = p === 0 ? 1 : depth[p - 1] + 1; });
    const rowOf = new Array<number>(d.parent.length).fill(0);
    let next = 0;
    const visit = (node: number) => {
      rowOf[node - 1] = next++;
      d.parent.forEach((p, i) => { if (p === node) visit(i + 1); });
    };
    d.parent.forEach((p, i) => { if (p === 0) visit(i + 1); });
    const maxDepth = Math.max(...depth);
    return { depth, rowOf, maxDepth, h: Math.max(next, 2) * ROW + 40 };
  }, [d.parent]);

  const x = (node: number) => (node === 0 ? 70 : 70 + (layout.depth[node - 1] * (W - 160)) / (layout.maxDepth + 0.15));
  const y = (node: number) => (node === 0 ? layout.h / 2 : 50 + layout.rowOf[node - 1] * ROW);
  const sizeOf = (i: number) => Number(settings[`d${i}`]);
  const set = (i: number, v: string) => setSettings({ ...settings, [`d${i}`]: v });
  const step = (i: number) => {
    if (disabled) return;
    const at = d.sizes.indexOf(sizeOf(i));
    set(i, String(d.sizes[(at + 1) % d.sizes.length]));
  };
  const cost = d.parent.reduce((sum, _, i) => sum + (d.costPerM[sizeOf(i)] ?? 0) * d.length[i], 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
      <svg viewBox={`0 0 ${W} ${layout.h}`} className="w-full rounded-lg border border-[var(--m-rule)] bg-[#f4f8fb]" role="group" aria-label="Water network">
        {d.parent.map((p, i) => {
          const v = overlay?.velocity?.[i];
          const bad = v !== undefined && (v > d.vMax || v < d.vMin);
          const color = overlay ? (bad ? "#c0392b" : "#1b7f5c") : "#2563eb";
          const mx = (x(p) + x(i + 1)) / 2;
          const my = (y(p) + y(i + 1)) / 2;
          return (
            <g key={`p${i}`} onClick={() => step(i)} className={disabled ? "" : "cursor-pointer"}>
              <line x1={x(p)} y1={y(p)} x2={x(i + 1)} y2={y(i + 1)} stroke={color} strokeWidth={2 + sizeOf(i) / 28} strokeLinecap="round" opacity={0.85} />
              <line x1={x(p)} y1={y(p)} x2={x(i + 1)} y2={y(i + 1)} stroke="transparent" strokeWidth={20} />
              <rect x={mx - 40} y={my - 17} width={80} height={32} rx={6} fill="#fff" stroke={color} />
              <text x={mx} y={my - 3} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1c1c1c">{sizeOf(i)} mm</text>
              <text x={mx} y={my + 10} textAnchor="middle" fontSize={9.5} fill="#6b6659">{d.length[i]} m{v !== undefined ? ` · ${v} m/s` : ""}</text>
            </g>
          );
        })}
        <g>
          <rect x={22} y={layout.h / 2 - 34} width={56} height={68} rx={8} fill="#cfe3f5" stroke="#2563eb" strokeWidth={2} />
          <text x={50} y={layout.h / 2 - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1c3f66">Reservoir</text>
          <text x={50} y={layout.h / 2 + 12} textAnchor="middle" fontSize={10} fill="#1c3f66">{d.head} m</text>
        </g>
        {d.parent.map((_, i) => {
          const pr = overlay?.pressure?.[i];
          const ok = pr === undefined ? null : pr >= d.pMinM;
          return (
            <g key={`n${i}`}>
              <circle cx={x(i + 1)} cy={y(i + 1)} r={19} fill={ok === null ? "#fff" : ok ? "#d9f2e6" : "#f9d6d2"} stroke={ok === null ? "#2b2b2b" : ok ? "#1b7f5c" : "#c0392b"} strokeWidth={2.5} />
              <text x={x(i + 1)} y={y(i + 1) + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1c1c1c">{i + 1}</text>
              <text x={x(i + 1)} y={y(i + 1) + 34} textAnchor="middle" fontSize={10} fill="#6b6659">{d.demandLps[i]} L/s · +{d.elev[i]} m</text>
              {pr !== undefined && <text x={x(i + 1)} y={y(i + 1) - 25} textAnchor="middle" fontSize={11} fontWeight={700} fill={ok ? "#1b7f5c" : "#c0392b"}>{pr.toFixed(1)} m</text>}
            </g>
          );
        })}
      </svg>
      <div>
        <p className="font-lp-body text-[12.5px] font-semibold text-app-muted">Pipe diameters</p>
        <div className="mt-2 space-y-2">
          {d.parent.map((p, i) => (
            <label key={i} className="block font-lp-body text-[12px] text-app-muted">
              {p === 0 ? "Reservoir" : `Node ${p}`} → node {i + 1}
              <select value={String(settings[`d${i}`])} disabled={disabled} onChange={(e) => set(i, e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--m-rule)] bg-white px-2.5 py-1.5 font-lp-mono text-[12.5px] text-[var(--m-ink)]">
                {d.sizes.map((s) => <option key={s} value={s}>{s} mm</option>)}
              </select>
            </label>
          ))}
        </div>
        <p className="mt-3 font-lp-mono text-[12px] text-[var(--m-ink)]">Cost so far: ₹{Math.round(cost).toLocaleString("en-IN")}</p>
        <p className="font-lp-body text-[11.5px] text-app-muted">Budget ₹{d.budget.toLocaleString("en-IN")} · nodes need {d.pMinM} m</p>
      </div>
    </div>
  );
}
