"use client";

import { analyseBeam } from "@/lib/arena-challenges/missions/sim/rcbeam";
import type { Outcome, Settings } from "@/lib/arena-challenges/missions/types";

interface BeamData { spanM: number; udlKnm: number; pointKn: number; budget: number; sizes: { b: { min: number; max: number; step: number }; D: { min: number; max: number; step: number }; n: { min: number; max: number; step: number } }; diameters: number[] }
interface Props { data: unknown; settings: Settings; setSettings: (s: Settings) => void; disabled: boolean; outcome: Outcome | null }

const W = 700;
const COVER = 40;

/** The beam as a designer sees it: loads on the span, the bending-moment diagram against the section's capacity, and the cross-section to scale. */
export function BeamSurface({ data, settings, setSettings, disabled }: Props) {
  const d = data as BeamData;
  const b = Number(settings.b);
  const D = Number(settings.D);
  const dia = Number(settings.dia);
  const n = Number(settings.n);
  const r = analyseBeam({ spanM: d.spanM, udlKnm: d.udlKnm, pointKn: d.pointKn, b, D, dia, n });
  const set = (id: string, v: string | number) => setSettings({ ...settings, [id]: v });

  const top = Math.max(...r.moments, r.muCapKnm) * 1.1;
  const mx = (i: number) => 40 + (i * 380) / 20;
  const my = (m: number) => 200 - (m / top) * 100;
  const secScale = Math.min(150 / D, 130 / b);
  const secX = 500;
  const secY = 30;
  const barsWidth = Math.max(0, b - 2 * 33);
  const gap = n > 1 ? (barsWidth - dia) / (n - 1) : 0;

  return (
    <div>
      <svg viewBox={`0 0 ${W} 240`} className="w-full rounded-lg border border-[var(--m-rule)] bg-[#fbfaf7]" role="img" aria-label="Beam, bending moment diagram and cross-section">
        {Array.from({ length: 11 }, (_, k) => <line key={k} x1={40 + (k * 380) / 10} y1={30} x2={40 + (k * 380) / 10} y2={52} stroke="#c0392b" strokeWidth={1.4} />)}
        <line x1={40} y1={30} x2={420} y2={30} stroke="#c0392b" strokeWidth={1.4} />
        <text x={230} y={22} textAnchor="middle" fontSize={10.5} fill="#c0392b">{d.udlKnm} kN/m{d.pointKn ? ` + ${d.pointKn} kN at mid-span` : ""}</text>
        {d.pointKn > 0 && <g><line x1={230} y1={26} x2={230} y2={56} stroke="#c0392b" strokeWidth={3} /><polygon points="230,60 224,50 236,50" fill="#c0392b" /></g>}
        <rect x={40} y={54} width={380} height={12} fill="#cfc9bb" stroke="#6b6659" />
        <polygon points="40,66 30,82 50,82" fill="#8a8578" /><circle cx={420} cy={76} r={8} fill="#8a8578" />
        <text x={230} y={88} textAnchor="middle" fontSize={10} fill="#6b6659">span {d.spanM} m</text>
        <line x1={40} y1={200} x2={420} y2={200} stroke="#6b6659" />
        <polyline fill="rgba(37,99,235,0.14)" stroke="#2563eb" strokeWidth={2.4} points={`${mx(0)},200 ${r.moments.map((m, i) => `${mx(i)},${my(m)}`).join(" ")} ${mx(20)},200`} />
        <line x1={40} y1={my(r.muCapKnm)} x2={420} y2={my(r.muCapKnm)} stroke={r.muCapKnm >= r.muKnm ? "#1b7f5c" : "#c0392b"} strokeWidth={2} strokeDasharray="6 4" />
        <text x={424} y={my(r.muCapKnm) + 3} fontSize={10} fill={r.muCapKnm >= r.muKnm ? "#1b7f5c" : "#c0392b"}>capacity {r.muCapKnm.toFixed(0)}</text>
        <text x={mx(10)} y={my(r.muKnm) - 6} textAnchor="middle" fontSize={10} fill="#2563eb">demand {r.muKnm.toFixed(0)} kN·m</text>
        <text x={40} y={218} fontSize={10} fill="#6b6659">factored bending moment along the span</text>
        <text x={secX + 10} y={secY - 8} fontSize={10} fill="#6b6659">cross-section {b} × {D} mm</text>
        <rect x={secX} y={secY} width={b * secScale} height={D * secScale} fill="#d9d4c7" stroke="#6b6659" strokeWidth={1.5} />
        <rect x={secX + 33 * secScale} y={secY + 33 * secScale} width={Math.max(0, (b - 66) * secScale)} height={Math.max(0, (D - 66) * secScale)} fill="none" stroke="#8a8578" strokeDasharray="3 3" />
        {Array.from({ length: n }, (_, i) => <circle key={i} cx={secX + (33 + dia / 2 + i * gap) * secScale} cy={secY + (D - COVER + dia / 2 - dia / 2) * secScale} r={Math.max(2, (dia / 2) * secScale)} fill={r.barsFit ? "#2b2b2b" : "#c0392b"} />)}
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["b", "D"] as const).map((k) => (
          <label key={k} className="block font-lp-body text-[11.5px] text-app-muted"><span className="flex justify-between"><span>{k === "b" ? "Width" : "Overall depth"}</span><output className="font-lp-mono text-[var(--m-ink)]">{String(settings[k])} mm</output></span>
            <input type="range" min={d.sizes[k].min} max={d.sizes[k].max} step={d.sizes[k].step} value={Number(settings[k])} disabled={disabled} onChange={(e) => set(k, Number(e.target.value))} className="mt-1 w-full accent-[var(--m-ink)]" />
          </label>
        ))}
        <label className="block font-lp-body text-[11.5px] text-app-muted"><span className="flex justify-between"><span>Bars</span><output className="font-lp-mono text-[var(--m-ink)]">{n}</output></span>
          <input type="range" min={d.sizes.n.min} max={d.sizes.n.max} step={1} value={n} disabled={disabled} onChange={(e) => set("n", Number(e.target.value))} className="mt-1 w-full accent-[var(--m-ink)]" />
        </label>
        <label className="block font-lp-body text-[11.5px] text-app-muted">Bar diameter
          <select value={String(settings.dia)} disabled={disabled} onChange={(e) => set("dia", e.target.value)} className="mt-1 w-full rounded-md border border-[var(--m-rule)] bg-white px-2 py-1.5 font-lp-mono text-[12.5px] text-[var(--m-ink)]">{d.diameters.map((x) => <option key={x} value={x}>{x} mm</option>)}</select>
        </label>
      </div>
      <p className="mt-2 font-lp-mono text-[12px] text-[var(--m-ink)]">Steel {r.astMm2.toFixed(0)} mm² · span ÷ depth {r.ld.toFixed(1)} (max {r.ldLimit}) · shear {r.tauV.toFixed(2)} N/mm² (max {r.tauMax}) · cost ₹{Math.round(r.cost).toLocaleString("en-IN")} of ₹{d.budget.toLocaleString("en-IN")}</p>
    </div>
  );
}
