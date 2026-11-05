import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Geotechnical / Foundation Engineering: cantilever retaining wall, Rankine active pressure Ka = tan²(45° − φ/2). Per metre run of wall.
interface S { height: number; gamma: number; phi: number; qa: number; budget: number }

const BASE = Array.from({ length: 17 }, (_, i) => 1.5 + i * 0.25);
const TOE = [0.5, 0.75, 1, 1.25, 1.5, 2];
const STEM = [0.3, 0.4, 0.5, 0.6, 0.8];
const SLAB = [0.4, 0.5, 0.6, 0.8];
const GC = 24;

function analyse(s: S, st: Settings) {
  const b = Number(st.b);
  const toe = Number(st.toe);
  const ts = Number(st.ts);
  const tb = Number(st.tb);
  const ht = s.height + tb;
  const heel = Math.max(0, b - toe - ts);
  const ka = Math.tan(((45 - s.phi / 2) * Math.PI) / 180) ** 2;
  const pa = 0.5 * ka * s.gamma * ht * ht;
  const parts = [
    { w: s.height * ts * GC, x: toe + ts / 2 },
    { w: b * tb * GC, x: b / 2 },
    { w: heel * s.height * s.gamma, x: toe + ts + heel / 2 },
  ];
  const sw = parts.reduce((a, p) => a + p.w, 0);
  const mr = parts.reduce((a, p) => a + p.w * p.x, 0);
  const mo = pa * (ht / 3);
  const xbar = (mr - mo) / sw;
  const e = b / 2 - xbar;
  return { b, toe, ts, tb, pa, sw, fsOt: mr / mo, fsSl: (sw * Math.tan(((2 / 3) * s.phi * Math.PI) / 180)) / pa, e, qmax: (sw / b) * (1 + (6 * e) / b), qmin: (sw / b) * (1 - (6 * e) / b), cost: (b * tb + s.height * ts) * 7000, valid: heel > 0 };
}

const lab: Lab<S> = {
  key: "retaining-wall",
  family: "civil",
  format: "simulation",
  name: "Wall design desk",
  topic: "Geotechnical and Foundation Engineering · Retaining walls",
  keywords: ["geotechnical", "foundation engineering", "soil", "ground improvement", "highway", "bridge", "retaining"],
  tools: ["Base width", "Toe length", "Stem thickness", "Base thickness", "Pressure diagram"],
  skillTags: ["Rankine pressure", "Overturning and sliding", "Bearing pressure"],
  makeScenario(rng, d) {
    const base: S = { height: rng.pick([3, 3.5, 4, 4.5, 5, 6, 7]), gamma: rng.pick([17, 18, 19, 20]), phi: rng.pick([28, 30, 32, 34, 36]), qa: 0, budget: 0 };
    const ok = [...gridSettings(lab.controls(base))].filter((st) => { const a = analyse(base, st); return a.valid && a.fsOt >= 2 && a.fsSl >= 1.5 && a.e <= a.b / 6; });
    if (!ok.length) return { ...base, qa: 250, budget: 100000 };
    const ref = rng.pick(ok);
    const a = analyse(base, ref);
    return { ...base, qa: Math.ceil((a.qmax * (d === "easy" ? 1.5 : d === "medium" ? 1.2 : 1.05)) / 5) * 5, budget: Math.ceil((a.cost * (d === "easy" ? 1.6 : d === "medium" ? 1.25 : 1.06)) / 500) * 500 };
  },
  given: (s) => [{ label: "Retained height", value: `${s.height} m of soil, unit weight ${s.gamma} kN/m³, φ = ${s.phi}°` }, { label: "Foundation soil", value: `safe bearing pressure ${s.qa} kPa` }, { label: "Budget", value: `${rupees(s.budget)} of concrete per metre of wall` }],
  mission: (s) => `Proportion the wall to hold ${s.height} m of soil: overturning factor ≥ 2, sliding ≥ 1.5, resultant in the middle third, base pressure ≤ ${s.qa} kPa, within ${rupees(s.budget)} per metre.`,
  controls: () => [
    { kind: "choice", id: "b", label: "Base width", options: choices(BASE, (v) => `${v} m`), default: "1.5" },
    { kind: "choice", id: "toe", label: "Toe projection", options: choices(TOE, (v) => `${v} m`), default: "0.5" },
    { kind: "choice", id: "ts", label: "Stem thickness", options: choices(STEM, (v) => `${v} m`), default: "0.3" },
    { kind: "choice", id: "tb", label: "Base slab thickness", options: choices(SLAB, (v) => `${v} m`), default: "0.4" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("ot", "Overturning factor ≥ 2", a.valid && a.fsOt >= 2, a.valid ? `${fmt(a.fsOt)}` : "no heel", "Resisting moment (wall + soil on the heel) over the overturning moment of the earth pressure."),
      objective("sl", "Sliding factor ≥ 1.5", a.valid && a.fsSl >= 1.5, a.valid ? `${fmt(a.fsSl)}` : "no heel", "Friction under the base is μ × total weight; it must beat the horizontal thrust."),
      objective("mid", "Resultant in the middle third (no tension)", a.valid && a.e <= a.b / 6, `e = ${fmt(a.e, 2)} m, limit ${fmt(a.b / 6, 2)} m`, "If the resultant leaves the middle third, the heel lifts off the soil."),
      objective("q", `Max base pressure ≤ ${s.qa} kPa`, a.valid && a.qmax <= s.qa, `${fmt(a.qmax, 0)} kPa`, "The toe carries the highest pressure. A wider base spreads the load."),
      objective("cost", `Concrete ≤ ${rupees(s.budget)}/m`, a.cost <= s.budget, rupees(a.cost), "Concrete in the base and stem is what you pay for."),
    ];
    return {
      readings: [gauge("ot", "Overturning factor", a.fsOt, fmt(a.fsOt), { min: 0, max: 5, low: 2 }), gauge("sl", "Sliding factor", a.fsSl, fmt(a.fsSl), { min: 0, max: 4, low: 1.5 }), gauge("q", "Toe pressure", a.qmax, `${fmt(a.qmax, 0)} kPa`, { min: 0, max: s.qa * 2, high: s.qa }), info("pa", "Earth thrust", `${fmt(a.pa, 0)} kN/m`)],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Pressure under the base", xLabel: "distance from toe (m)", yLabel: "pressure (kPa)", lines: [{ name: "Soil pressure", pts: [[0, a.qmax], [a.b, Math.max(0, a.qmin)]], style: "main" }, { name: "Safe bearing", pts: [[0, s.qa], [a.b, s.qa]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `Earth thrust is ${fmt(a.pa, 0)} kN per metre, acting a third of the way up. The wall weighs ${fmt(a.sw, 0)} kN/m including the soil on the heel, giving an overturning factor of ${fmt(a.fsOt)} and a sliding factor of ${fmt(a.fsSl)}. The resultant sits ${fmt(a.e, 2)} m from the base centre, so pressure runs from ${fmt(a.qmax, 0)} kPa at the toe to ${fmt(a.qmin, 0)} kPa at the heel. A longer heel mobilises more soil weight, which is usually the cheapest way to add stability.`;
  },
  fallback: (s) => ({ title: `Hold back ${s.height} m of hillside`, story: `A new road cuts into a hillside, leaving ${s.height} m of soil to be held back from a village school. The designer must size a cantilever wall that stays put in the monsoon.` }),
};
export default defineLab(lab);
