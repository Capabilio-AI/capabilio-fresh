import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Half-wave or bridge rectifier with a reservoir capacitor, simulated cycle by cycle (diode drop 0.7 V, 50 Hz mains, constant-current load).
interface S { iload: number; vmin: number; rippleMax: number; pivRating: number; budget: number }

const F = 50;
const TRANSFORMERS = { 9: 120, 12: 140, 15: 170, 18: 200, 24: 260 } as Record<number, number>;
const CAPS = { 0: 0, 100: 6, 220: 9, 470: 14, 1000: 26, 2200: 48, 4700: 95 } as Record<number, number>;
const DIODE = 4;
const DT = 5e-5;

function analyse(s: S, st: Settings) {
  const vrms = Number(st.vrms);
  const bridge = st.type === "bridge";
  const c = Number(st.cap) * 1e-6;
  const vsm = vrms * Math.SQRT2;
  const vp = vsm - (bridge ? 1.4 : 0.7);
  const i = s.iload / 1000;
  let vc = 0;
  let lo = Infinity;
  let hi = -Infinity;
  let sum = 0;
  let n = 0;
  const total = Math.round((6 / F) / DT);
  const measureFrom = Math.round((4 / F) / DT);
  const trace: [number, number, number][] = [];
  for (let k = 0; k < total; k++) {
    const t = k * DT;
    const vin = vp * Math.sin(2 * Math.PI * F * t);
    const rect = bridge ? Math.abs(vin) : Math.max(vin, 0);
    let vo: number;
    if (c === 0) vo = rect;
    else {
      vc = rect >= vc ? rect : Math.max(0, vc - (i * DT) / c);
      vo = vc;
    }
    if (k >= measureFrom) {
      lo = Math.min(lo, vo);
      hi = Math.max(hi, vo);
      sum += vo;
      n++;
      if (k % 8 === 0) trace.push([(t - 4 / F) * 1000, rect, vo]);
    }
  }
  const piv = bridge ? vsm : c > 0 ? 2 * vsm : vsm;
  const cost = (TRANSFORMERS[vrms] ?? 0) + (bridge ? 4 : 1) * DIODE + (CAPS[Number(st.cap)] ?? 0);
  return { vdc: sum / n, ripple: hi - lo, piv, cost, trace, vp, fr: bridge ? 2 * F : F };
}

const lab: Lab<S> = {
  key: "rectifier",
  family: "ece",
  format: "simulation",
  name: "Rectifier bench",
  topic: "Analog Electronics · Diodes and rectifiers",
  keywords: ["analog", "diode", "electronic devices", "electronic circuits", "rectifier", "power supply"],
  tools: ["Transformer", "Diodes", "Reservoir capacitor", "Oscilloscope"],
  skillTags: ["Rectifiers", "Diode circuits", "Ripple"],
  makeScenario(rng, d) {
    const base: S = {
      iload: rng.pick([100, 150, 250, 400, 500]),
      vmin: rng.pick([7, 9, 10.5, 12]),
      rippleMax: d === "easy" ? rng.pick([2, 2.5, 3]) : d === "medium" ? rng.pick([1, 1.5]) : rng.pick([0.5, 0.8]),
      pivRating: rng.pick([50, 100]),
      budget: Infinity,
    };
    let cheapest = Infinity;
    for (const st of gridSettings(lab.controls(base))) {
      const a = analyse(base, st);
      if (a.vdc >= base.vmin && a.ripple <= base.rippleMax && a.piv <= base.pivRating) cheapest = Math.min(cheapest, a.cost);
    }
    return { ...base, budget: Number.isFinite(cheapest) ? Math.ceil((cheapest * (d === "easy" ? 1.8 : d === "medium" ? 1.3 : 1.05)) / 10) * 10 : 400 };
  },
  given: (s) => [
    { label: "Load", value: `${s.iload} mA, drawn steadily` },
    { label: "Mains", value: "50 Hz; each silicon diode drops 0.7 V" },
    { label: "Diode rating", value: `${s.pivRating} V peak inverse voltage` },
    { label: "Budget", value: rupees(s.budget) },
  ],
  mission: (s) => `Deliver at least ${fmt(s.vmin, 1)} V average with no more than ${fmt(s.rippleMax, 1)} V of ripple, inside ${rupees(s.budget)} and within the diode rating.`,
  controls: () => [
    { kind: "choice", id: "vrms", label: "Transformer secondary", options: choices([9, 12, 15, 18, 24], (v) => `${v} V rms`), default: "9" },
    { kind: "choice", id: "type", label: "Rectifier", options: [{ value: "half", label: "Half-wave (1 diode)" }, { value: "bridge", label: "Full-wave bridge (4 diodes)" }], default: "half" },
    { kind: "choice", id: "cap", label: "Reservoir capacitor", options: choices([0, 100, 220, 470, 1000, 2200, 4700], (v) => (v === "0" ? "None" : `${v} µF`)), default: "0" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("vdc", `Average output ≥ ${fmt(s.vmin, 1)} V`, a.vdc >= s.vmin, `measured ${fmt(a.vdc)} V`, "The average output cannot exceed the peak of the secondary minus the diode drops. Is the transformer big enough?"),
      objective("ripple", `Ripple ≤ ${fmt(s.rippleMax, 1)} V peak-to-peak`, a.ripple <= s.rippleMax, `measured ${fmt(a.ripple)} V`, "Between peaks the capacitor alone feeds the load and sags. What decides how far it sags?"),
      objective("piv", `Diode peak inverse voltage ≤ ${s.pivRating} V`, a.piv <= s.pivRating, `diodes see ${fmt(a.piv, 1)} V`, "In a half-wave circuit with a capacitor the reverse voltage across the diode is about twice the transformer peak."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, `this build costs ${rupees(a.cost)}`, "A bigger transformer or capacitor costs more. Which part is over-sized?"),
    ];
    return {
      readings: [
        gauge("vdc", "Average output", a.vdc, `${fmt(a.vdc)} V`, { min: 0, max: Math.max(25, a.vdc * 1.2), low: s.vmin }),
        gauge("ripple", "Ripple (peak-to-peak)", a.ripple, `${fmt(a.ripple)} V`, { min: 0, max: Math.max(s.rippleMax * 3, a.ripple * 1.1), high: s.rippleMax }),
        gauge("piv", "Diode reverse voltage", a.piv, `${fmt(a.piv, 1)} V`, { min: 0, max: Math.max(s.pivRating * 1.5, a.piv * 1.1), high: s.pivRating }),
        gauge("cost", "Cost", a.cost, rupees(a.cost), { min: 0, max: Math.max(s.budget * 1.5, a.cost * 1.1), high: s.budget }),
        info("fr", "Ripple frequency", `${a.fr} Hz`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Rectified input and output voltage",
        xLabel: "time (ms)",
        yLabel: "volts",
        lines: [
          { name: "Rectified input", pts: a.trace.map(([t, r]) => [t, r]), style: "ref" },
          { name: "Output", pts: a.trace.map(([t, , o]) => [t, o]), style: "main" },
          { name: `Minimum ${fmt(s.vmin, 1)} V`, pts: [[a.trace[0][0], s.vmin], [a.trace[a.trace.length - 1][0], s.vmin]], style: "limit" },
        ],
      },
    };
  },
  explain(s, st, o) {
    const a = analyse(s, st);
    const c = Number(st.cap);
    const estimate = c > 0 ? (s.iload / 1000 / (a.fr * c * 1e-6)) : a.vp;
    return `The secondary peaks at ${fmt(Number(st.vrms) * Math.SQRT2, 1)} V and the diodes drop ${st.type === "bridge" ? "1.4" : "0.7"} V, leaving ${fmt(a.vp, 1)} V at the top. A ${st.type === "bridge" ? "bridge" : "half-wave"} rectifier tops the capacitor up ${a.fr} times a second, and between tops the ${s.iload} mA load drains it by about I/(f·C) = ${fmt(estimate)} V, which the simulation measured as ${fmt(a.ripple)} V. That is why a larger capacitor or a full-wave rectifier (twice the refills) cuts ripple, and why the diode in a capacitor-filtered half-wave circuit must withstand about twice the transformer peak. ${o.passed ? "Your design met every limit." : ""}`;
  },
  fallback: (s) => ({
    title: `Emergency supply for a ${s.iload} mA load`,
    story: `A clinic's backup unit lost its power supply and the technician has a transformer, some diodes and capacitors on the bench. The unit needs a steady DC rail from the mains. Build the supply from the parts available.`,
  }),
};
export default defineLab(lab);
