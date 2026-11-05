import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Network Analysis / Linear Control Systems: series RLC step response, the capacitor voltage. ωn = 1/√(LC), ζ = (R/2)·√(C/L).
interface S { lmh: number; osMaxPct: number; tsMaxMs: number; vs: number }

const RS = [1, 2, 5, 10, 15, 22, 33, 47, 68, 100, 150, 220, 330, 470, 680, 1000];
const CS = [0.1, 0.22, 0.47, 1, 2.2, 4.7, 10, 22, 47, 100]; // µF

function analyse(s: S, st: Settings) {
  const r = Number(st.r);
  const c = Number(st.c) * 1e-6;
  const l = s.lmh * 1e-3;
  const wn = 1 / Math.sqrt(l * c);
  const zeta = (r / 2) * Math.sqrt(c / l);
  const vc = (t: number) => {
    if (zeta < 1) {
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * wn * t) * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t));
    }
    if (zeta === 1) return 1 - Math.exp(-wn * t) * (1 + wn * t);
    const sq = Math.sqrt(zeta * zeta - 1);
    const p1 = wn * (zeta - sq);
    const p2 = wn * (zeta + sq);
    return 1 - (p2 * Math.exp(-p1 * t) - p1 * Math.exp(-p2 * t)) / (p2 - p1);
  };
  const horizon = 8 / Math.max(1e-9, Math.min(zeta, 1) * wn) * (zeta > 1 ? zeta + Math.sqrt(zeta * zeta - 1) : 1);
  let os = 0;
  let ts = 0;
  const N = 600;
  for (let i = 1; i <= N; i++) {
    const t = (i / N) * horizon;
    const v = vc(t);
    os = Math.max(os, (v - 1) * 100);
    if (Math.abs(v - 1) > 0.02) ts = t;
  }
  return { r, c, wn, zeta, vc, horizon, os, tsMs: ts * 1000 };
}

const lab: Lab<S> = {
  key: "rlc-step",
  family: "ece",
  format: "simulation",
  name: "Network analyser",
  topic: "Network Analysis / Linear Control · Second-order step response",
  keywords: ["network analysis", "linear control", "control systems", "circuit", "signals and systems", "transient"],
  tools: ["Step source", "Resistor decade", "Capacitor decade", "Oscilloscope"],
  skillTags: ["Damping ratio", "Overshoot", "Settling time"],
  makeScenario(rng, d) {
    const base: S = { lmh: rng.int(2, 200) / 2, vs: rng.int(6, 30) / 2, osMaxPct: (d === "easy" ? 22 : d === "medium" ? 8 : 4) + rng.int(0, 6), tsMaxMs: Infinity };
    let fastest = Infinity;
    for (const st of gridSettings(lab.controls(base))) {
      const a = analyse(base, st);
      if (a.os <= base.osMaxPct) fastest = Math.min(fastest, a.tsMs);
    }
    return { ...base, tsMaxMs: Number.isFinite(fastest) ? Number((fastest * (d === "easy" ? 4 : d === "medium" ? 2 : 1.4)).toPrecision(3)) : 50 };
  },
  given: (s) => [
    { label: "Inductor", value: `${s.lmh} mH` },
    { label: "Supply step", value: `0 to ${s.vs} V` },
    { label: "Allowed overshoot", value: `${s.osMaxPct}%` },
    { label: "Allowed settling time", value: `${s.tsMaxMs} ms to within 2%` },
  ],
  mission: (s) => `Choose R and C so the output settles within 2% in under ${s.tsMaxMs} ms with overshoot under ${s.osMaxPct}% (fast but not ringing).`,
  controls: () => [
    { kind: "choice", id: "r", label: "Resistor", options: choices(RS, (v) => `${v} Ω`), default: "1" },
    { kind: "choice", id: "c", label: "Capacitor", options: choices(CS, (v) => `${v} µF`), default: "0.1" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const wnHz = a.wn / (2 * Math.PI);
    const objectives = [
      objective("os", `Overshoot ≤ ${s.osMaxPct}%`, a.os <= s.osMaxPct, `${fmt(a.os, 1)}% (ζ = ${fmt(a.zeta)})`, "Overshoot depends only on the damping ratio ζ = (R/2)√(C/L). Is the circuit under- or over-damped?"),
      objective("fast", `Settles within 2% in ≤ ${s.tsMaxMs} ms`, a.tsMs <= s.tsMaxMs, `${fmt(a.tsMs, 2)} ms (fn = ${fmt(wnHz, 0)} Hz)`, "A low-ζ circuit rings for a long time; a high-ζ one crawls. The fastest settling sits near ζ ≈ 0.7–1."),
    ];
    const pts: [number, number][] = Array.from({ length: 121 }, (_, i) => {
      const t = (i / 120) * a.horizon;
      return [Number((t * 1000).toFixed(4)), a.vc(t) * s.vs];
    });
    return {
      readings: [info("z", "Damping ratio ζ", fmt(a.zeta)), gauge("os", "Overshoot", a.os, `${fmt(a.os, 1)}%`, { min: 0, max: 60, high: s.osMaxPct }), info("fn", "Natural frequency", `${fmt(wnHz, 0)} Hz`)],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Capacitor voltage after the step", xLabel: "time (ms)", yLabel: "volts", lines: [{ name: "vC(t)", pts, style: "main" }, { name: "Final value", pts: [[0, s.vs], [a.horizon * 1000, s.vs]], style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `With R = ${a.r} Ω and C = ${fmt(a.c * 1e6)} µF the natural frequency is ${fmt(a.wn / (2 * Math.PI), 0)} Hz and ζ = ${fmt(a.zeta)}, so the overshoot is ${fmt(a.os, 1)}% and the output is within 2% after ${fmt(a.tsMs, 2)} ms. Small ζ rings, large ζ is slow; the same trade-off appears in every second-order system from filters to motor position loops.`;
  },
  fallback: (s) => ({
    title: `Tame the ringing on a ${s.vs} V rail`,
    story: `A ${s.vs} V sensor rail is switched on through a ${s.lmh} mH choke, and the output rings badly. The technician can pick the damping resistor and the reservoir capacitor.`,
  }),
};
export default defineLab(lab);
