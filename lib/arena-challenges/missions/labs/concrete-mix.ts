import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Concrete Technology: Abrams-type strength law f28 = 90 / 5.06^(w/c) (illustrative, calibrated to ~40 MPa at w/c 0.5); slump rises with water and superplasticiser.
interface S { fck: number; slumpLow: number; slumpHigh: number; cementMin: number; cementMax: number; budget: number }

const WC = Array.from({ length: 11 }, (_, i) => Number((0.3 + i * 0.03).toFixed(2)));
const WATER = [140, 150, 160, 170, 180, 190, 200, 210];
const SP = [0, 0.5, 1, 1.5, 2];
const strength = (wc: number) => 90 / 5.06 ** wc;

function analyse(s: S, st: Settings) {
  const wc = Number(st.wc);
  const w = Number(st.water);
  const sp = Number(st.sp);
  const cement = w / wc;
  return { wc, w, sp, cement, f28: strength(wc), target: s.fck + 6.6, slump: 5 * (w - 150) + 70 * sp, cost: cement * 7.5 + (sp / 100) * cement * 95, mpa: strength };
}

const lab: Lab<S> = {
  key: "concrete-mix",
  family: "civil",
  format: "lab",
  name: "Concrete lab",
  topic: "Concrete Technology · Mix design",
  keywords: ["concrete technology", "building materials", "rcc", "reinforced concrete", "construction"],
  tools: ["Cement", "Water", "Superplasticiser", "Slump cone", "Cube press"],
  skillTags: ["Water–cement ratio", "Workability", "Mix proportioning"],
  makeScenario(rng, d) {
    const base: S = { fck: rng.pick([20, 25, 30, 35, 40]), slumpLow: 0, slumpHigh: 0, cementMin: 300, cementMax: 450, budget: 0 };
    const ref = rng.pick([...gridSettings(lab.controls(base))].filter((st) => { const a = analyse(base, st); return a.f28 >= a.target && a.cement >= 300 && a.cement <= 450 && a.slump >= 30 && a.slump <= 220; }));
    const a = analyse(base, ref);
    const c = Math.round(a.slump / 25) * 25;
    return { ...base, slumpLow: Math.max(25, c - (d === "easy" ? 50 : d === "medium" ? 25 : 12)), slumpHigh: c + (d === "easy" ? 50 : d === "medium" ? 25 : 12), cementMax: Math.max(a.cement + 5, Math.ceil(a.cement * (d === "easy" ? 1.15 : d === "medium" ? 1.06 : 1.02))), budget: Math.ceil(a.cost * (d === "easy" ? 1.3 : d === "medium" ? 1.1 : 1.03)) };
  },
  given: (s) => [{ label: "Grade", value: `M${s.fck} (target mean strength ${s.fck + 6.6} MPa)` }, { label: "Slump", value: `${s.slumpLow}–${s.slumpHigh} mm` }, { label: "Cement", value: `${s.cementMin}–${s.cementMax} kg/m³ for durability and heat` }, { label: "Budget", value: `${rupees(s.budget)} per m³ for cement and admixture` }],
  mission: (s) => `Proportion a M${s.fck} mix: mean strength ≥ ${s.fck + 6.6} MPa, slump ${s.slumpLow}–${s.slumpHigh} mm, cement ${s.cementMin}–${s.cementMax} kg/m³, within ${rupees(s.budget)} per m³.`,
  controls: () => [
    { kind: "choice", id: "wc", label: "Water–cement ratio", options: choices(WC), default: "0.6" },
    { kind: "choice", id: "water", label: "Water content", options: choices(WATER, (v) => `${v} kg/m³`), default: "140" },
    { kind: "choice", id: "sp", label: "Superplasticiser", options: choices(SP, (v) => `${v}% of cement`), default: "0" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("str", `28-day strength ≥ ${s.fck + 6.6} MPa`, a.f28 >= a.target, `${fmt(a.f28, 1)} MPa`, "Strength depends on the water–cement ratio: less water per cement, stronger paste."),
      objective("slump", `Slump ${s.slumpLow}–${s.slumpHigh} mm`, a.slump >= s.slumpLow && a.slump <= s.slumpHigh, `${fmt(a.slump, 0)} mm`, "Workability comes from water or admixture. Water also weakens the mix unless cement rises with it."),
      objective("cem", `Cement ${s.cementMin}–${s.cementMax} kg/m³`, a.cement >= s.cementMin && a.cement <= s.cementMax, `${fmt(a.cement, 0)} kg/m³`, "Cement = water ÷ (w/c). Too little hurts durability; too much cracks from heat of hydration."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}/m³`, a.cost <= s.budget, rupees(a.cost), "Cement is the main cost; a plasticiser can buy workability more cheaply than extra water and cement."),
    ];
    const pts: [number, number][] = WC.map((w) => [w, a.mpa(w)]);
    return {
      readings: [info("c", "Cement", `${fmt(a.cement, 0)} kg/m³`), gauge("f", "Strength", a.f28, `${fmt(a.f28, 1)} MPa`, { min: 0, max: 70, low: a.target }), gauge("s", "Slump", a.slump, `${fmt(a.slump, 0)} mm`, { min: 0, max: 260, low: s.slumpLow, high: s.slumpHigh })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Strength against water–cement ratio", xLabel: "w/c", yLabel: "28-day strength (MPa)", lines: [{ name: "Strength", pts, style: "main" }, { name: "Required", pts: [[WC[0], a.target], [WC[WC.length - 1], a.target]], style: "limit" }, { name: "Your mix", pts: [[a.wc, 0], [a.wc, 90 / 5.06 ** WC[0]]], style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `At w/c = ${a.wc} the strength is ${fmt(a.f28, 1)} MPa, against ${a.target} MPa needed (characteristic strength plus 1.65 × 4 MPa margin, rounded). ${a.w} kg of water at that ratio needs ${fmt(a.cement, 0)} kg of cement. Water gives slump (${fmt(a.slump, 0)} mm) but each extra kilogram needs more cement to keep w/c, which costs money and heat; a superplasticiser raises slump without touching w/c.`;
  },
  fallback: (s) => ({ title: `Mix M${s.fck} for the flyover deck`, story: `A flyover deck needs M${s.fck} concrete pumped to site, so it must flow well but stay strong. The site engineer can adjust the water, cement ratio and admixture dose.` }),
};
export default defineLab(lab);
