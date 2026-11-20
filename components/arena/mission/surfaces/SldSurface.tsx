"use client";

import { curvePoints, opTime } from "@/lib/arena-challenges/missions/sim/tcc";
import type { Outcome, Settings } from "@/lib/arena-challenges/missions/types";

interface SldData { load: number[]; fault: number[]; tMax: number[]; margin: number; pickups: number[]; tms: number[] }
interface Props { data: unknown; settings: Settings; setSettings: (s: Settings) => void; disabled: boolean; outcome: Outcome | null }

const COLORS = ["#2563eb", "#d97706", "#7c3aed"];
const CW = 460;
const CH = 300;
const M = { l: 44, r: 12, t: 12, b: 34 };

/** Substation protection: a single-line diagram of three breakers in series, their relay settings, and the time-current curves those settings draw. */
export function SldSurface({ data, settings, setSettings, disabled, outcome }: Props) {
  const d = data as SldData;
  const relay = (k: number) => ({ pickup: Number(settings[`p${k}`]), tms: Number(settings[`t${k}`]) });
  const set = (id: string, v: string) => setSettings({ ...settings, [id]: v });

  const lo = Math.min(...d.load) * 0.8;
  const hi = Math.max(...d.fault) * 1.4;
  const xs = (i: number) => M.l + ((Math.log10(i) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (CW - M.l - M.r);
  const ys = (t: number) => M.t + ((Math.log10(100) - Math.log10(t)) / (Math.log10(100) - Math.log10(0.02))) * (CH - M.t - M.b);
  const path = (k: number) => curvePoints(relay(k).pickup, relay(k).tms, lo, hi).map((p, i) => `${i ? "L" : "M"}${xs(p.i).toFixed(1)},${ys(p.t).toFixed(1)}`).join(" ");
  const decade = [0.1, 1, 10, 100];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <svg viewBox="0 0 460 150" className="w-full rounded-lg border border-[var(--m-rule)] bg-[#fbfaf7]" role="img" aria-label="Single-line diagram: source, three breakers with relays, load">
          <circle cx={30} cy={75} r={17} fill="none" stroke="#2b2b2b" strokeWidth={2} />
          <path d="M20 75 q5 -9 10 0 t10 0" fill="none" stroke="#2b2b2b" strokeWidth={1.8} />
          <text x={30} y={108} textAnchor="middle" fontSize={10} fill="#6b6659">Source</text>
          <line x1={47} y1={75} x2={430} y2={75} stroke="#2b2b2b" strokeWidth={2.5} />
          {[3, 2, 1].map((k, n) => {
            const cx = 100 + n * 105;
            return (
              <g key={k}>
                <rect x={cx - 11} y={64} width={22} height={22} fill="#fff" stroke={COLORS[k - 1]} strokeWidth={3} />
                <line x1={cx} y1={86} x2={cx} y2={112} stroke={COLORS[k - 1]} strokeWidth={1.5} strokeDasharray="3 3" />
                <rect x={cx - 22} y={112} width={44} height={22} rx={4} fill={COLORS[k - 1]} />
                <text x={cx} y={127} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">R{k}</text>
                <text x={cx} y={55} textAnchor="middle" fontSize={10} fill="#6b6659">{d.load[k - 1]} A load</text>
              </g>
            );
          })}
          <polygon points="395,63 395,87 415,75" fill="#2b2b2b" />
          <text x={425} y={79} fontSize={10} fill="#6b6659">Load</text>
          {d.fault.map((f, k) => (
            <text key={k} x={[372, 267, 162][k]} y={30} textAnchor="middle" fontSize={10} fontWeight={700} fill="#c0392b">⚡ F{k + 1} {f} A</text>
          ))}
        </svg>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((k) => (
            <fieldset key={k} className="rounded-lg border bg-white p-3" style={{ borderColor: COLORS[k - 1] }}>
              <legend className="px-1 font-lp-mono text-[12px] font-bold" style={{ color: COLORS[k - 1] }}>Relay {k}</legend>
              <label className="block font-lp-body text-[11.5px] text-app-muted">Pickup
                <select value={String(settings[`p${k}`])} disabled={disabled} onChange={(e) => set(`p${k}`, e.target.value)} className="mt-1 w-full rounded-md border border-[var(--m-rule)] bg-white px-2 py-1.5 font-lp-mono text-[12.5px] text-[var(--m-ink)]">
                  {d.pickups.map((p) => <option key={p} value={p}>{p} A</option>)}
                </select>
              </label>
              <label className="mt-2 block font-lp-body text-[11.5px] text-app-muted">Time multiplier
                <select value={String(settings[`t${k}`])} disabled={disabled} onChange={(e) => set(`t${k}`, e.target.value)} className="mt-1 w-full rounded-md border border-[var(--m-rule)] bg-white px-2 py-1.5 font-lp-mono text-[12.5px] text-[var(--m-ink)]">
                  {d.tms.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <p className="mt-2 font-lp-mono text-[11px] text-app-muted">Trips on its own fault in {Number.isFinite(opTime(d.fault[k - 1], relay(k).pickup, relay(k).tms)) ? `${opTime(d.fault[k - 1], relay(k).pickup, relay(k).tms).toFixed(2)} s` : "never"}</p>
            </fieldset>
          ))}
        </div>
      </div>
      <div>
        <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full rounded-lg border border-[var(--m-rule)] bg-white" role="img" aria-label="Time-current curves of the three relays">
          {decade.map((t) => (
            <g key={t}>
              <line x1={M.l} y1={ys(t)} x2={CW - M.r} y2={ys(t)} stroke="#e7e3d8" />
              <text x={M.l - 6} y={ys(t) + 3} textAnchor="end" fontSize={9.5} fill="#6b6659">{t} s</text>
            </g>
          ))}
          {d.fault.map((f, k) => (
            <g key={k}>
              <line x1={xs(f)} y1={M.t} x2={xs(f)} y2={CH - M.b} stroke="#c0392b" strokeDasharray="4 4" opacity={0.7} />
              <text x={xs(f)} y={CH - M.b + 13} textAnchor="middle" fontSize={9.5} fill="#c0392b">F{k + 1}</text>
            </g>
          ))}
          {d.load.map((l, k) => <line key={k} x1={xs(l)} y1={CH - M.b - 8} x2={xs(l)} y2={CH - M.b} stroke={COLORS[k]} strokeWidth={3} />)}
          {[1, 2, 3].map((k) => <path key={k} d={path(k)} fill="none" stroke={COLORS[k - 1]} strokeWidth={2.4} />)}
          <text x={(CW + M.l) / 2} y={CH - 6} textAnchor="middle" fontSize={10} fill="#6b6659">Current (A, log scale)</text>
        </svg>
        <p className="mt-2 font-lp-body text-[11.5px] leading-relaxed text-app-muted">Short coloured ticks mark each relay&apos;s normal load; dashed red lines mark the fault currents. A curve to the right of its load tick will not trip on load. For one fault the curves must stack in order, relay 1 lowest, with a gap of at least {d.margin} s.{outcome ? "" : " Change a setting and watch the curve move."}</p>
      </div>
    </div>
  );
}
