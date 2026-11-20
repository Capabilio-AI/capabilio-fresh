"use client";

import { useMemo } from "react";
import type { Outcome, Settings } from "@/lib/arena-challenges/missions/types";

interface TrussData {
  joints: { x: number; y: number; name: string }[];
  supports: { joint: number; kind: "pin" | "roller" }[];
  load: { joint: number; kn: number };
  candidates: [number, number][];
  sections: { label: string; areaCm2: number }[];
  material: string;
  budgetKg: number;
  deflectionMm: number;
  maxMembers: number;
}
interface Props { data: unknown; settings: Settings; setSettings: (s: Settings) => void; disabled: boolean; outcome: Outcome | null }
type Member = [number, number, number];

const W = 760;
const PAD = 54;
const STROKE = [3, 6, 11];

function read(raw: unknown): Member[] {
  try {
    const m = (JSON.parse(String(raw || "{}")) as { m?: Member[] }).m;
    return Array.isArray(m) ? m : [];
  } catch {
    return [];
  }
}

/** The truss canvas: dotted lines are members you may add; click one to add it, click a member to make it heavier, again to remove it. */
export function TrussSurface({ data, settings, setSettings, disabled, outcome }: Props) {
  const d = data as TrussData;
  const members = useMemo(() => read(settings.design), [settings.design]);
  const forces = useMemo(() => new Map(((outcome?.overlay as { members?: { a: number; b: number; force: number; util: number }[] } | undefined)?.members ?? []).map((m) => [`${m.a}-${m.b}`, m])), [outcome]);

  const xs = d.joints.map((j) => j.x);
  const ys = d.joints.map((j) => j.y);
  const sc = (W - PAD * 2) / Math.max(1, Math.max(...xs) - Math.min(...xs));
  const H = Math.max(...ys) * sc + PAD * 2 + 28;
  const px = (j: number) => PAD + (d.joints[j].x - Math.min(...xs)) * sc;
  const py = (j: number) => H - PAD - 14 - (d.joints[j].y - Math.min(...ys)) * sc;
  const find = (a: number, b: number) => members.findIndex((m) => m[0] === a && m[1] === b);

  const write = (next: Member[]) => setSettings({ ...settings, design: next.length ? JSON.stringify({ m: next }) : "" });
  const click = (a: number, b: number) => {
    if (disabled) return;
    const i = find(a, b);
    if (i < 0) return members.length < d.maxMembers ? write([...members, [a, b, 0]]) : undefined;
    const size = members[i][2];
    write(size >= d.sections.length - 1 ? members.filter((_, k) => k !== i) : members.map((m, k) => (k === i ? [m[0], m[1], size + 1] : m)));
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-[var(--m-rule)] bg-[#fbfaf7]" role="group" aria-label="Truss canvas">
        {d.candidates.filter(([a, b]) => find(a, b) < 0).map(([a, b]) => (
          <g key={`c${a}-${b}`} onClick={() => click(a, b)} className={disabled ? "" : "cursor-pointer"}>
            <line x1={px(a)} y1={py(a)} x2={px(b)} y2={py(b)} stroke="#c9c4b8" strokeWidth={1.5} strokeDasharray="2 5" />
            <line x1={px(a)} y1={py(a)} x2={px(b)} y2={py(b)} stroke="transparent" strokeWidth={16} />
          </g>
        ))}
        {members.map(([a, b, size]) => {
          const r = forces.get(`${a}-${b}`);
          const color = !r ? "#2b2b2b" : r.util > 1 ? "#c0392b" : r.force >= 0 ? "#2563eb" : "#d97706";
          const mx = (px(a) + px(b)) / 2;
          const my = (py(a) + py(b)) / 2;
          return (
            <g key={`m${a}-${b}`} onClick={() => click(a, b)} className={disabled ? "" : "cursor-pointer"}>
              <line x1={px(a)} y1={py(a)} x2={px(b)} y2={py(b)} stroke={color} strokeWidth={STROKE[size] ?? 6} strokeLinecap="round" opacity={0.9} />
              <line x1={px(a)} y1={py(a)} x2={px(b)} y2={py(b)} stroke="transparent" strokeWidth={18} />
              {r && <text x={mx} y={my - 7} textAnchor="middle" fontSize={11} fontWeight={600} fill={color}>{Math.abs(r.force).toFixed(1)} kN {r.force >= 0 ? "T" : "C"}{r.util > 1 ? " ⚠" : ""}</text>}
            </g>
          );
        })}
        {d.supports.map((s) => (
          <g key={`s${s.joint}`}>
            {s.kind === "pin" ? <polygon points={`${px(s.joint)},${py(s.joint)} ${px(s.joint) - 13},${py(s.joint) + 22} ${px(s.joint) + 13},${py(s.joint) + 22}`} fill="#8a8578" /> : <circle cx={px(s.joint)} cy={py(s.joint) + 12} r={10} fill="#8a8578" />}
            <text x={px(s.joint)} y={py(s.joint) + 40} textAnchor="middle" fontSize={10} fill="#6b6659">{s.kind}</text>
          </g>
        ))}
        <g>
          <line x1={px(d.load.joint)} y1={py(d.load.joint) - 46} x2={px(d.load.joint)} y2={py(d.load.joint) - 8} stroke="#c0392b" strokeWidth={3} />
          <polygon points={`${px(d.load.joint)},${py(d.load.joint) - 4} ${px(d.load.joint) - 6},${py(d.load.joint) - 14} ${px(d.load.joint) + 6},${py(d.load.joint) - 14}`} fill="#c0392b" />
          <text x={px(d.load.joint) + 10} y={py(d.load.joint) - 34} fontSize={12} fontWeight={700} fill="#c0392b">{d.load.kn} kN</text>
        </g>
        {d.joints.map((j, i) => (
          <g key={`j${i}`}>
            <circle cx={px(i)} cy={py(i)} r={7} fill="#fff" stroke="#2b2b2b" strokeWidth={2} />
            <text x={px(i)} y={py(i) + (j.y > 0 ? -14 : 24)} textAnchor="middle" fontSize={10} fill="#6b6659">{j.name}</text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-lp-body text-[12px] text-app-muted">
        <span>{members.length} of {d.maxMembers} members</span>
        <span>{d.material}</span>
        <span>Click a dotted line to add a member, click a member to change its section: {d.sections.map((s) => s.label).join(" → ")} → remove</span>
        {outcome && <span className="font-semibold"><span className="text-[#2563eb]">Blue</span> tension · <span className="text-[#d97706]">orange</span> compression · <span className="text-[#c0392b]">red</span> over its limit</span>}
      </div>
    </div>
  );
}
