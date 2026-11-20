"use client";

import { analyseFeeder } from "@/lib/arena-challenges/missions/sim/feeder";
import type { Outcome, Settings } from "@/lib/arena-challenges/missions/types";

interface FeederData { r: number[]; x: number[]; pKw: number[]; qKvar: number[]; budgetKvar: number; options: number[]; vLow: number; vHigh: number; pfTarget: number }
interface Props { data: unknown; settings: Settings; setSettings: (s: Settings) => void; disabled: boolean; outcome: Outcome | null }

const W = 700;
const BUS_X = (i: number) => 120 + i * 150;

/** A feeder one-line with load arrows and capacitor banks, and the voltage profile those banks produce. */
export function FeederSurface({ data, settings, setSettings, disabled }: Props) {
  const d = data as FeederData;
  const caps = d.pKw.map((_, i) => Number(settings[`c${i}`]));
  const f = analyseFeeder({ r: d.r, x: d.x, pKw: d.pKw, qKvar: d.qKvar, capKvar: caps });
  const total = caps.reduce((a, c) => a + c, 0);
  const vlo = 0.84;
  const vhi = 1.08;
  const px = (i: number) => BUS_X(i);
  const py = (v: number) => 292 - ((v - vlo) / (vhi - vlo)) * 90;
  const profile = [1, ...f.voltage];

  return (
    <div>
      <svg viewBox={`0 0 ${W} 310`} className="w-full rounded-lg border border-[var(--m-rule)] bg-[#fbfaf7]" role="img" aria-label="Distribution feeder with loads and capacitor banks">
        <circle cx={50} cy={50} r={17} fill="none" stroke="#2b2b2b" strokeWidth={2} />
        <text x={50} y={54} textAnchor="middle" fontSize={11} fontWeight={700}>~</text>
        <text x={50} y={84} textAnchor="middle" fontSize={10} fill="#6b6659">Substation</text>
        <line x1={67} y1={50} x2={BUS_X(d.pKw.length - 1) + 30} y2={50} stroke="#2b2b2b" strokeWidth={3} />
        {d.pKw.map((p, i) => {
          const v = f.voltage[i];
          const good = v >= d.vLow && v <= d.vHigh;
          return (
            <g key={i}>
              <circle cx={px(i)} cy={50} r={8} fill={good ? "#1b7f5c" : "#c0392b"} />
              <text x={px(i)} y={32} textAnchor="middle" fontSize={11} fontWeight={700} fill={good ? "#1b7f5c" : "#c0392b"}>{v.toFixed(3)} pu</text>
              <line x1={px(i)} y1={58} x2={px(i)} y2={98} stroke="#6b6659" strokeWidth={1.5} />
              <polygon points={`${px(i) - 6},96 ${px(i) + 6},96 ${px(i)},108`} fill="#6b6659" />
              <text x={px(i)} y={124} textAnchor="middle" fontSize={10} fill="#6b6659">{p} kW</text>
              <text x={px(i)} y={137} textAnchor="middle" fontSize={10} fill="#6b6659">{d.qKvar[i]} kvar</text>
              {caps[i] > 0 && (
                <g>
                  <line x1={px(i) + 34} y1={50} x2={px(i) + 34} y2={72} stroke="#7c3aed" strokeWidth={1.5} />
                  <line x1={px(i) + 24} y1={72} x2={px(i) + 44} y2={72} stroke="#7c3aed" strokeWidth={3} />
                  <line x1={px(i) + 24} y1={79} x2={px(i) + 44} y2={79} stroke="#7c3aed" strokeWidth={3} />
                  <text x={px(i) + 34} y={96} textAnchor="middle" fontSize={10} fontWeight={700} fill="#7c3aed">{caps[i]} kvar</text>
                </g>
              )}
            </g>
          );
        })}
        <line x1={BUS_X(0) - 30} y1={py(1)} x2={BUS_X(d.pKw.length - 1) + 30} y2={py(1)} stroke="#e7e3d8" />
        <rect x={BUS_X(0) - 30} y={py(d.vHigh)} width={BUS_X(d.pKw.length - 1) - BUS_X(0) + 60} height={py(d.vLow) - py(d.vHigh)} fill="#1b7f5c" opacity={0.12} />
        <text x={BUS_X(0) - 34} y={py(d.vLow) + 3} textAnchor="end" fontSize={9.5} fill="#1b7f5c">{d.vLow}</text>
        <text x={BUS_X(0) - 34} y={py(d.vHigh) + 3} textAnchor="end" fontSize={9.5} fill="#1b7f5c">{d.vHigh}</text>
        <polyline fill="none" stroke="#2563eb" strokeWidth={2.5} points={f.voltage.map((v, i) => `${px(i)},${py(v)}`).join(" ")} />
        {f.voltage.map((v, i) => <circle key={i} cx={px(i)} cy={py(v)} r={4} fill="#2563eb" />)}
        <text x={BUS_X(0) - 30} y={188} fontSize={10} fill="#6b6659">voltage profile (per unit), green band = allowed</text>
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {d.pKw.map((_, i) => (
          <label key={i} className="block font-lp-body text-[11.5px] text-app-muted">Capacitor at bus {i + 1}
            <select value={String(settings[`c${i}`])} disabled={disabled} onChange={(e) => setSettings({ ...settings, [`c${i}`]: e.target.value })} className="mt-1 w-full rounded-md border border-[var(--m-rule)] bg-white px-2 py-1.5 font-lp-mono text-[12.5px] text-[var(--m-ink)]">
              {d.options.map((o) => <option key={o} value={o}>{o === 0 ? "None" : `${o} kvar`}</option>)}
            </select>
          </label>
        ))}
      </div>
      <p className="mt-2 font-lp-mono text-[12px] text-[var(--m-ink)]">Capacitors {total} of {d.budgetKvar} kvar · power factor {f.pf.toFixed(3)}{f.qNetKvar < 0 ? " (leading)" : ""} · losses {f.lossKw.toFixed(0)} kW · profile {profile.map((v) => v.toFixed(2)).join(" → ")}</p>
    </div>
  );
}
