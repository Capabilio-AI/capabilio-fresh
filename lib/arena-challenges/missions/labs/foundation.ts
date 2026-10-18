import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Square isolated footing. Gross pressure q = P/B² + 20·Df. Allowable pressure qa = qa0 + k·Df. Elastic settlement s = (P/B²)·B·(1−ν²)·If/E (ν = 0.3, If = 0.82).
interface S { soil: "clay" | "sand"; load: number; qa0: number; k: number; e: number; sMax: number; budget: number }

function analyse(s: S, st: Settings) {
  const B = Number(st.b);
  const df = Number(st.df);
  const cushion = st.imp === "cushion";
  const qa = (s.qa0 + s.k * df) * (cushion ? 1.25 : 1);
  const q = s.load / (B * B) + 20 * df;
  const eEff = s.e * 1000 * (cushion ? 1.4 : 1);
  const settle = ((s.load / (B * B)) * B * 0.91 * 0.82 / eEff) * 1000;
  const t = Math.max(0.4, B / 5);
  const cost = B * B * t * 7500 + B * B * df * 350 + (cushion ? B * B * 540 : 0);
  return { B, df, qa, q, settle, cost, cushion };
}

const lab: Lab<S> = {
  key: "foundation",
  family: "civil",
  format: "simulation",
  name: "Geotechnical desk",
  topic: "Geotechnical Engineering · Shallow foundations",
  keywords: ["geotechnical", "soil", "foundation", "foundation engineering", "bearing"],
  tools: ["Soil report", "Footing sizes", "Excavation depth", "Settlement check"],
  skillTags: ["Bearing capacity", "Settlement", "Footing design"],
  makeScenario(rng, d) {
    const soil = rng.pick(["clay", "sand"] as const);
    const base: S = soil === "clay"
      ? { soil, load: rng.int(8, 20) * 100, qa0: rng.int(9, 15) * 10, k: 6, e: rng.int(6, 12), sMax: d === "hard" ? 25 : 40, budget: Infinity }
      : { soil, load: rng.int(10, 25) * 100, qa0: rng.int(15, 25) * 10, k: rng.pick([25, 30, 40]), e: rng.int(15, 30), sMax: d === "hard" ? 25 : 40, budget: Infinity };
    let cheapest = Infinity;
    for (const st of gridSettings(lab.controls(base))) {
      const a = analyse(base, st);
      if (a.q <= a.qa && a.settle <= base.sMax) cheapest = Math.min(cheapest, a.cost);
    }
    return { ...base, budget: Number.isFinite(cheapest) ? Math.ceil((cheapest * (d === "easy" ? 1.7 : d === "medium" ? 1.25 : 1.05)) / 500) * 500 : 200000 };
  },
  given: (s) => [
    { label: "Column load", value: `${s.load} kN` },
    { label: "Soil", value: s.soil === "clay" ? `soft clay, allowable pressure ${s.qa0} kPa at the surface rising ${s.k} kPa per metre` : `medium sand, allowable pressure ${s.qa0} kPa at the surface rising ${s.k} kPa per metre` },
    { label: "Stiffness", value: `E = ${s.e} MPa` },
    { label: "Limits", value: `settlement ≤ ${s.sMax} mm, cost ≤ ${rupees(s.budget)}` },
  ],
  mission: (s) => `Choose the footing width, depth and ground treatment so the soil is not overstressed, the settlement stays under ${s.sMax} mm and the cost stays under ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "number", id: "b", label: "Footing width B", min: 1.5, max: 4.5, step: 0.25, unit: "m", default: 1.5 },
    { kind: "number", id: "df", label: "Founding depth Df", min: 1, max: 3, step: 0.5, unit: "m", default: 1 },
    { kind: "choice", id: "imp", label: "Ground treatment", options: [{ value: "none", label: "None" }, { value: "cushion", label: "Compacted sand cushion" }], default: "none" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("bearing", "Bearing pressure ≤ allowable", a.q <= a.qa, `${fmt(a.q, 0)} kPa against ${fmt(a.qa, 0)} kPa`, "Pressure is load over area. How does widening the footing change it?"),
      objective("settle", `Settlement ≤ ${s.sMax} mm`, a.settle <= s.sMax, `${fmt(a.settle, 1)} mm`, "Settlement depends on how stiff the soil under the footing is and how large the loaded area is. Can you stiffen the ground?"),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Footing volume grows with the square of the width. Is the footing bigger than the soil demands?"),
    ];
    const pts = Array.from({ length: 13 }, (_, i): [number, number] => {
      const B = 1.5 + i * 0.25;
      return [B, s.load / (B * B) + 20 * a.df];
    });
    return {
      readings: [
        gauge("bearing", "Bearing pressure", a.q, `${fmt(a.q, 0)} kPa`, { min: 0, max: Math.max(a.qa * 2, a.q * 1.1), high: a.qa }),
        gauge("settle", "Settlement", a.settle, `${fmt(a.settle, 1)} mm`, { min: 0, max: Math.max(s.sMax * 2.5, a.settle * 1.1), high: s.sMax }),
        gauge("cost", "Cost", a.cost, rupees(a.cost), { min: 0, max: Math.max(s.budget * 1.5, a.cost * 1.1), high: s.budget }),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Pressure under the footing against its width", xLabel: "footing width B (m)", yLabel: "pressure (kPa)", lines: [{ name: "Pressure", pts, style: "main" }, { name: "Allowable", pts: [[1.5, a.qa], [4.5, a.qa]], style: "limit" }, { name: "Your width", pts: [[a.B, 0], [a.B, Math.max(a.qa * 2, pts[0][1])]], style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The soil carries the footing load P spread over B², so the pressure falls with the square of the width: ${fmt(s.load / (a.B * a.B), 0)} kPa from the column plus ${fmt(20 * a.df, 0)} kPa from the footing and backfill, ${fmt(a.q, 0)} kPa in all against ${fmt(a.qa, 0)} kPa allowable. Passing the bearing check is not enough: the soil also compresses, and elastic settlement s ∝ q·B/E came to ${fmt(a.settle, 1)} mm. A wider footing lowers pressure but settles over a larger depth, going deeper raises the allowable pressure, and a sand cushion stiffens the soil at extra cost.`;
  },
  fallback: (s) => ({
    title: `Stop the ${s.load} kN column sinking`,
    story: `A single-storey workshop on ${s.soil === "clay" ? "soft clay" : "loose sandy fill"} has a column whose footing is sinking and cracking the wall beside it. The engineer must re-design the footing before the next rains.`,
  }),
};
export default defineLab(lab);
