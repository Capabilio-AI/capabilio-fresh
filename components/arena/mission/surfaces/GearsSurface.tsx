"use client";

import { analyseGears } from "@/lib/arena-challenges/missions/sim/gears";
import type { Outcome, Settings } from "@/lib/arena-challenges/missions/types";

interface GearsData { inRpm: number; targetRpm: number; tolerance: number; outTorqueNm: number; maxWidthMm: number; modules: number[]; tMin: number; tMax: number }
interface Props { data: unknown; settings: Settings; setSettings: (s: Settings) => void; disabled: boolean; outcome: Outcome | null }

const W = 720;
const H = 300;
const COLORS = ["#2563eb", "#d97706", "#7c3aed", "#1b7f5c"];

/** A toothed wheel drawn as a thick dashed circle: the dashes are the teeth, so changing the tooth count visibly changes the gear. */
function Gear({ cx, cy, r, teeth, color, label, dim }: { cx: number; cy: number; r: number; teeth: number; color: string; label: string; dim?: boolean }) {
  const pitch = (2 * Math.PI * r) / (teeth * 2);
  return (
    <g opacity={dim ? 0.55 : 0.92}>
      <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.18} />
      <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke={color} strokeWidth={9} strokeDasharray={`${pitch} ${pitch}`} />
      <circle cx={cx} cy={cy} r={5} fill="#2b2b2b" />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1c1c1c">{label}</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize={11} fill="#1c1c1c">{teeth} teeth</text>
    </g>
  );
}

/** The gear train from the side: four wheels on three shafts, drawn to scale from the module and tooth counts. */
export function GearsSurface({ data, settings, setSettings, disabled }: Props) {
  const d = data as GearsData;
  const teeth = ["z1", "z2", "z3", "z4"].map((k) => Number(settings[k])) as [number, number, number, number];
  const m = Number(settings.m);
  const r = analyseGears({ teeth, module: m, inRpm: d.inRpm, outTorqueNm: d.outTorqueNm });
  const radius = r.pitchMm.map((p) => p / 2);
  const reach = r.centreMm[0] + r.centreMm[1] + radius[0] + radius[3];
  const scale = Math.min((W - 60) / Math.max(reach, 1), (H - 60) / (2 * Math.max(...radius, 1)));
  const x0 = 30 + radius[0] * scale;
  const xs = [x0, x0 + r.centreMm[0] * scale, x0 + r.centreMm[0] * scale, x0 + (r.centreMm[0] + r.centreMm[1]) * scale];
  const cy = H / 2;
  const widthX = (mm: number) => x0 + mm * scale;
  const set = (id: string, v: string | number) => setSettings({ ...settings, [id]: v });
  const ok = r.widthMm <= d.maxWidthMm;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-[var(--m-rule)] bg-[#f6f6f2]" role="img" aria-label="Two-stage gear train">
        <Gear cx={xs[1]} cy={cy} r={radius[1] * scale} teeth={teeth[1]} color={COLORS[1]} label="Gear 2" dim />
        <Gear cx={xs[0]} cy={cy} r={radius[0] * scale} teeth={teeth[0]} color={COLORS[0]} label="Gear 1 (input)" />
        <Gear cx={xs[2]} cy={cy} r={radius[2] * scale} teeth={teeth[2]} color={COLORS[2]} label="Gear 3" />
        <Gear cx={xs[3]} cy={cy} r={radius[3] * scale} teeth={teeth[3]} color={COLORS[3]} label="Gear 4 (output)" />
        <line x1={x0} y1={H - 18} x2={widthX(d.maxWidthMm)} y2={H - 18} stroke="#6b6659" strokeDasharray="4 4" />
        <line x1={x0} y1={H - 18} x2={widthX(r.widthMm)} y2={H - 18} stroke={ok ? "#1b7f5c" : "#c0392b"} strokeWidth={4} />
        <text x={x0} y={H - 24} fontSize={10.5} fill={ok ? "#1b7f5c" : "#c0392b"}>centres {r.widthMm.toFixed(0)} mm of {d.maxWidthMm} mm</text>
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["z1", "z2", "z3", "z4"] as const).map((k, i) => (
          <label key={k} className="block font-lp-body text-[11.5px] text-app-muted">
            <span className="flex justify-between"><span style={{ color: COLORS[i] }} className="font-semibold">Gear {i + 1}</span><output className="font-lp-mono text-[var(--m-ink)]">{String(settings[k])}</output></span>
            <input type="range" min={d.tMin - 5} max={d.tMax} step={1} value={Number(settings[k])} disabled={disabled} onChange={(e) => set(k, Number(e.target.value))} className="mt-1 w-full accent-[var(--m-ink)]" />
          </label>
        ))}
        <label className="block font-lp-body text-[11.5px] text-app-muted">Module
          <select value={String(settings.m)} disabled={disabled} onChange={(e) => set("m", e.target.value)} className="mt-1 w-full rounded-md border border-[var(--m-rule)] bg-white px-2 py-1.5 font-lp-mono text-[12.5px] text-[var(--m-ink)]">{d.modules.map((x) => <option key={x} value={x}>{x} mm</option>)}</select>
        </label>
      </div>
      <p className="mt-2 font-lp-mono text-[12px] text-[var(--m-ink)]">Ratio {r.ratio.toFixed(2)} · output {r.outRpm.toFixed(0)} rpm (needs {d.targetRpm}) · {d.inRpm} rpm in</p>
    </div>
  );
}
