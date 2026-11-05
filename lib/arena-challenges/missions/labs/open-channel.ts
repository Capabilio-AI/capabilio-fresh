import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Hydraulics / Water Resources / Irrigation: trapezoidal channel by Manning's equation Q = (1/n)·A·R^(2/3)·√S. Fr = V/√(g·A/T).
interface S { q: number; slope: number; budget: number }

const B = Array.from({ length: 15 }, (_, i) => 1 + i * 0.5);
const Y = Array.from({ length: 11 }, (_, i) => 0.5 + i * 0.25);
const Z = [1, 1.5, 2, 3];
const LINING = { concrete: { n: 0.015, vmax: 3, price: 2600 }, brick: { n: 0.017, vmax: 2, price: 1500 }, "earth (compacted)": { n: 0.025, vmax: 1, price: 0 } } as const;

function flow(s: S, b: number, y: number, z: number, n: number) {
  const area = (b + z * y) * y;
  const per = b + 2 * y * Math.sqrt(1 + z * z);
  const q = (1 / n) * area * (area / per) ** (2 / 3) * Math.sqrt(s.slope);
  return { area, per, q, v: q / area, fr: q / area / Math.sqrt((9.81 * area) / (b + 2 * z * y)) };
}
function analyse(s: S, st: Settings) {
  const l = LINING[String(st.lining) as keyof typeof LINING];
  const b = Number(st.b);
  const y = Number(st.y);
  const z = Number(st.z);
  const f = flow(s, b, y, z, l.n);
  const dug = (b + z * (y + 0.5)) * (y + 0.5);
  return { ...f, l, b, y, z, cost: dug * 220 + f.per * l.price, discharge: (yy: number) => flow(s, b, yy, z, l.n).q };
}

const lab: Lab<S> = {
  key: "open-channel",
  family: "civil",
  format: "simulation",
  name: "Canal design desk",
  topic: "Hydraulics and Water Resources · Open-channel flow",
  keywords: ["hydraulics", "water resources", "irrigation", "fluid mechanics", "hydraulic structures", "channel"],
  tools: ["Bed width", "Water depth", "Side slope", "Lining", "Rating curve"],
  skillTags: ["Manning's equation", "Scour and silting velocity", "Froude number"],
  makeScenario(rng, d) {
    const slope = rng.pick([0.0002, 0.0003, 0.0005, 0.0008, 0.001, 0.002]);
    const base: S = { q: 0, slope, budget: 0 };
    const ok = [...gridSettings(lab.controls(base))].filter((st) => { const a = analyse(base, st); return a.v >= 0.6 && a.v <= a.l.vmax && a.fr <= 0.8 && a.q > 2; });
    if (!ok.length) return { q: 5, slope, budget: 10000 };
    const a = analyse(base, rng.pick(ok));
    return { q: Math.floor((a.q * (d === "easy" ? 0.75 : d === "medium" ? 0.9 : 0.97)) * 10) / 10, slope, budget: Math.ceil((a.cost * (d === "easy" ? 1.5 : d === "medium" ? 1.2 : 1.04)) / 100) * 100 };
  },
  given: (s) => [{ label: "Design discharge", value: `${s.q} m³/s` }, { label: "Bed slope", value: `1 in ${Math.round(1 / s.slope)}` }, { label: "Silt", value: "velocity must stay ≥ 0.6 m/s" }, { label: "Budget", value: `${rupees(s.budget)} per metre of canal` }],
  mission: (s) => `Shape and line the canal to carry ${s.q} m³/s with velocity between 0.6 m/s and what the lining can stand, subcritical flow (Fr ≤ 0.8), within ${rupees(s.budget)} per metre.`,
  controls: () => [
    { kind: "choice", id: "b", label: "Bed width", options: choices(B, (v) => `${v} m`), default: "1" },
    { kind: "choice", id: "y", label: "Water depth", options: choices(Y, (v) => `${v} m`), default: "0.5" },
    { kind: "choice", id: "z", label: "Side slope (H : 1)", options: choices(Z), default: "1" },
    { kind: "choice", id: "lining", label: "Lining", options: choices(Object.keys(LINING)), default: "concrete" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("q", `Carries ≥ ${s.q} m³/s`, a.q >= s.q, `${fmt(a.q, 2)} m³/s`, "Manning's equation: discharge grows with area, hydraulic radius and a smoother lining."),
      objective("v", `Velocity 0.6 – ${a.l.vmax} m/s`, a.v >= 0.6 && a.v <= a.l.vmax, `${fmt(a.v, 2)} m/s`, "Too slow and silt settles; too fast and the lining scours. Each lining has its own limit."),
      objective("fr", "Subcritical (Fr ≤ 0.8)", a.fr <= 0.8, `Fr = ${fmt(a.fr, 2)}`, "Near-critical flow is unstable and forms waves that overtop the banks."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}/m`, a.cost <= s.budget, rupees(a.cost), "Excavation (with freeboard) and lining both cost money."),
    ];
    const pts: [number, number][] = Y.map((yy) => [yy, a.discharge(yy)]);
    return {
      readings: [gauge("q", "Discharge", a.q, `${fmt(a.q, 2)} m³/s`, { min: 0, max: Math.max(s.q * 2, a.q * 1.1), low: s.q }), gauge("v", "Velocity", a.v, `${fmt(a.v, 2)} m/s`, { min: 0, max: 4, low: 0.6, high: a.l.vmax }), info("fr", "Froude number", fmt(a.fr, 2))],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Rating curve (discharge against depth)", xLabel: "depth (m)", yLabel: "discharge (m³/s)", lines: [{ name: "Q(y)", pts, style: "main" }, { name: "Required", pts: [[Y[0], s.q], [Y[Y.length - 1], s.q]], style: "limit" }, { name: "Your depth", pts: [[a.y, 0], [a.y, Math.max(...pts.map((p) => p[1]))]], style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The ${a.b} m wide, ${a.y} m deep channel with ${a.z}:1 sides has an area of ${fmt(a.area, 2)} m² and wetted perimeter ${fmt(a.per, 2)} m. With ${String(st.lining)} lining (n = ${a.l.n}) Manning's equation gives ${fmt(a.q, 2)} m³/s at ${fmt(a.v, 2)} m/s. A smoother lining carries more water at lower cost of excavation but costs more per metre of lining and tolerates a higher velocity.`;
  },
  fallback: (s) => ({ title: `Carry ${s.q} m³/s to the tail-end farms`, story: `A distributary canal must deliver ${s.q} m³/s to farms at the tail end of a command area on a gentle slope. The irrigation engineer chooses its shape and lining.` }),
};
export default defineLab(lab);
