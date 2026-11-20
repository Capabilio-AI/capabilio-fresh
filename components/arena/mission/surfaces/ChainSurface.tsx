"use client";

import { analyseChain, snrDb, type Stage } from "@/lib/arena-challenges/missions/sim/chain";
import type { Outcome, Settings } from "@/lib/arena-challenges/missions/types";

interface ChainData { stages: Stage[]; inputDbm: number; bandwidthKhz: number; snrTarget: number; adcLow: number; adcHigh: number; rejectionNeed: number; powerMw: number; costBudget: number }
interface Props { data: unknown; settings: Settings; setSettings: (s: Settings) => void; disabled: boolean; outcome: Outcome | null }

const W = 640;
const H = 220;
const M = { l: 50, r: 16, t: 14, b: 34 };
const LABELS = ["Antenna", "After LNA", "After filter", "After gain", "ADC input"];

/** A receiver as a row of stage blocks: pick a part for each and watch signal and noise levels move through the chain. */
export function ChainSurface({ data, settings, setSettings, disabled }: Props) {
  const d = data as ChainData;
  const choice = d.stages.map((s) => Number(settings[s.id]));
  const r = analyseChain(choice, d.inputDbm, d.bandwidthKhz);
  const snr = snrDb(d.inputDbm, d.bandwidthKhz, r.nfDb, r.totalGainDb);
  const all = [...r.signal, ...r.noise, d.adcLow, d.adcHigh];
  const lo = Math.floor(Math.min(...all) / 10) * 10 - 5;
  const hi = Math.ceil(Math.max(...all) / 10) * 10 + 5;
  const x = (i: number) => M.l + (i * (W - M.l - M.r)) / 4;
  const y = (v: number) => M.t + ((hi - v) / (hi - lo)) * (H - M.t - M.b);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: Math.floor((hi - lo) / 20) + 1 }, (_, k) => lo + k * 20);

  return (
    <div>
      <div className="flex flex-wrap items-stretch gap-2">
        <div className="flex w-16 flex-col items-center justify-center rounded-lg border border-[var(--m-rule)] bg-[#fbfaf7] px-1 py-2 text-center font-lp-mono text-[11px] text-app-muted">📡<span>{d.inputDbm} dBm</span></div>
        {d.stages.map((s, i) => {
          const p = s.parts[choice[i]];
          return (
            <div key={s.id} className="flex min-w-[130px] flex-1 items-center gap-2">
              <span className="text-app-muted" aria-hidden>→</span>
              <label className="block flex-1 rounded-lg border border-[var(--m-rule)] bg-white p-2.5 font-lp-body text-[11.5px] text-app-muted">
                {s.label}
                <select value={String(settings[s.id])} disabled={disabled} onChange={(e) => setSettings({ ...settings, [s.id]: e.target.value })} className="mt-1 w-full rounded-md border border-[var(--m-rule)] bg-white px-1.5 py-1.5 font-lp-mono text-[12px] text-[var(--m-ink)]">
                  {s.parts.map((o, k) => <option key={o.name} value={k}>{o.name}</option>)}
                </select>
                <span className="mt-1.5 block font-lp-mono text-[10.5px] leading-snug">{p.gainDb >= 0 ? "+" : ""}{p.gainDb} dB · NF {p.nfDb} dB · {p.mA} mA · ₹{p.cost}{p.rejectionDb ? ` · rejects ${p.rejectionDb} dB` : ""}</span>
              </label>
            </div>
          );
        })}
        <div className="flex items-center gap-2"><span className="text-app-muted" aria-hidden>→</span><div className="rounded-lg bg-app-charcoal px-3 py-6 font-lp-mono text-[11px] font-bold text-white">ADC</div></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full rounded-lg border border-[var(--m-rule)] bg-white" role="img" aria-label="Signal and noise level through the receiver">
        {ticks.map((t) => <g key={t}><line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="#e7e3d8" /><text x={M.l - 6} y={y(t) + 3} textAnchor="end" fontSize={9.5} fill="#6b6659">{t}</text></g>)}
        <rect x={x(4) - 12} y={y(d.adcHigh)} width={24} height={y(d.adcLow) - y(d.adcHigh)} fill="#1b7f5c" opacity={0.25} />
        <text x={x(4) - 16} y={y(d.adcHigh) + 11} textAnchor="end" fontSize={9.5} fill="#1b7f5c">ADC window</text>
        <path d={line(r.noise)} fill="none" stroke="#c0392b" strokeWidth={2} strokeDasharray="5 4" />
        <path d={line(r.signal)} fill="none" stroke="#2563eb" strokeWidth={2.6} />
        {r.signal.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill="#2563eb" />)}
        {LABELS.map((l, i) => <text key={l} x={x(i)} y={H - 12} textAnchor="middle" fontSize={10} fill="#6b6659">{l}</text>)}
        <text x={M.l + 6} y={M.t + 10} fontSize={10} fill="#2563eb">— signal</text>
        <text x={M.l + 66} y={M.t + 10} fontSize={10} fill="#c0392b">- - noise</text>
        <text x={8} y={H / 2} fontSize={10} fill="#6b6659" transform={`rotate(-90 8 ${H / 2})`} textAnchor="middle">dBm</text>
      </svg>
      <p className="mt-2 font-lp-mono text-[12px] text-[var(--m-ink)]">Gain {r.totalGainDb.toFixed(1)} dB · noise figure {r.nfDb.toFixed(2)} dB · SNR {snr.toFixed(1)} dB (needs {d.snrTarget}) · {r.powerMw.toFixed(0)} mW (max {d.powerMw}) · ₹{r.cost} (max {d.costBudget}) · filtering {r.rejectionDb} dB (needs {d.rejectionNeed})</p>
    </div>
  );
}
