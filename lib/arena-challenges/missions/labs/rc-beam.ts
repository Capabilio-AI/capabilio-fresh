import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { analyseBeam, BAR_DIAMETERS, type BeamInput } from "../sim/rcbeam";

// Reinforced Concrete Design: size a simply supported beam and its tension steel. It must carry the factored moment in a ductile way, resist
// shear, stay stiff enough, fit its bars, and cost less than the budget. The diagram of bending moment redraws as the section changes.
interface S { spanM: number; udlKnm: number; pointKn: number; budget: number }

const SIZES = { b: { min: 200, max: 400, step: 25 }, D: { min: 300, max: 700, step: 25 }, n: { min: 2, max: 8, step: 1 } };
const inputOf = (s: S, st: Settings): BeamInput => ({ spanM: s.spanM, udlKnm: s.udlKnm, pointKn: s.pointKn, b: Number(st.b), D: Number(st.D), dia: Number(st.dia), n: Number(st.n) });

/** The cheapest section that passes every check, found by trying all of them: the benchmark a budget is set from. Null when nothing passes. */
function cheapest(s: Omit<S, "budget">): number | null {
  let best: number | null = null;
  for (let b = SIZES.b.min; b <= SIZES.b.max; b += SIZES.b.step) for (let D = SIZES.D.min; D <= SIZES.D.max; D += SIZES.D.step) for (const dia of BAR_DIAMETERS) for (let n = SIZES.n.min; n <= SIZES.n.max; n++) {
    const r = analyseBeam({ ...s, b, D, dia, n });
    if (passes(r) && (best === null || r.cost < best)) best = r.cost;
  }
  return best;
}
const passes = (r: ReturnType<typeof analyseBeam>) => r.muCapKnm >= r.muKnm && r.xuOverD <= r.xuMaxOverD && r.astMm2 >= r.astMinMm2 && r.tauV <= r.tauMax && r.ld <= r.ldLimit && r.barsFit;

const lab: Lab<S> = {
  key: "rc-beam",
  family: "civil",
  format: "simulation",
  surface: "beam",
  name: "Concrete beam designer",
  topic: "Reinforced Concrete Design · Beam design by limit state",
  keywords: ["reinforced concrete", "rcc", "concrete", "structural", "design of concrete", "structural analysis", "building", "strength of materials"],
  tools: ["Section drawing", "Bending-moment diagram", "Bar layout", "Cost estimate"],
  skillTags: ["Limit state design", "Under-reinforced section", "Beam shear and deflection"],
  makeScenario(rng, d) {
    const base = { spanM: rng.pick([4, 4.5, 5, 5.5, 6, 6.5]), udlKnm: rng.int(10, 30), pointKn: rng.pick([0, 0, 20, 40]) };
    const min = cheapest(base);
    const room = d === "easy" ? 1.3 : d === "medium" ? 1.15 : 1.05;
    return { ...base, budget: min === null ? 0 : Math.ceil((min * room) / 500) * 500 };
  },
  given: (s) => [
    { label: "Span", value: `${s.spanM} m, simply supported` },
    { label: "Loads (characteristic)", value: `${s.udlKnm} kN/m${s.pointKn ? ` plus ${s.pointKn} kN at mid-span` : ""}` },
    { label: "Materials", value: "M25 concrete, Fe500 steel, 40 mm cover" },
    { label: "Budget", value: rupees(s.budget) },
  ],
  mission: (s) => `Choose the beam width and depth and the tension bars so the section carries the factored moment as an under-reinforced beam, resists shear, keeps span ÷ depth within 26, fits its bars in one layer, and costs no more than ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "number", id: "b", label: "Beam width", ...SIZES.b, unit: "mm", default: 200 },
    { kind: "number", id: "D", label: "Overall depth", ...SIZES.D, unit: "mm", default: 300 },
    { kind: "choice", id: "dia", label: "Bar diameter", options: choices(BAR_DIAMETERS, (v) => `${v} mm`), default: "12" },
    { kind: "number", id: "n", label: "Number of bars", ...SIZES.n, unit: "bars", default: 2 },
  ],
  surfaceData: (s) => ({ spanM: s.spanM, udlKnm: s.udlKnm, pointKn: s.pointKn, budget: s.budget, sizes: SIZES, diameters: BAR_DIAMETERS }),
  evaluate(s, st): Outcome {
    const r = analyseBeam(inputOf(s, st));
    const objectives = [
      objective("flexure", "Section carries the factored moment", r.muCapKnm >= r.muKnm, `${fmt(r.muCapKnm, 0)} kN·m against ${fmt(r.muKnm, 0)} kN·m`, "Moment capacity grows with the steel area and with the effective depth. Depth helps far more than width."),
      objective("ductile", "Under-reinforced, with minimum steel", r.xuOverD <= r.xuMaxOverD && r.astMm2 >= r.astMinMm2, `neutral axis ${fmt(r.xuOverD, 2)} d (limit ${r.xuMaxOverD}), steel ${fmt(r.astMm2, 0)} mm²`, "Too much steel makes the concrete crush before the steel yields, with no warning. Too little cracks suddenly. Aim between the minimum and the limit."),
      objective("shear", `Shear stress ≤ ${r.tauMax} N/mm²`, r.tauV <= r.tauMax, `${fmt(r.tauV, 2)} N/mm²`, "Shear is carried by the web, so a narrow or shallow beam is stressed more near the supports."),
      objective("deflect", `Span ÷ depth ≤ ${r.ldLimit}`, r.ld <= r.ldLimit, fmt(r.ld, 1), "A slender beam sags too much. Depth is what keeps it stiff."),
      objective("fit", "Bars fit in one layer", r.barsFit, r.barsFit ? "bars fit with clear spacing" : "too many or too large for the width", "Bars need clear space between them for the concrete to flow. Either widen the beam or use fewer, larger bars."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, r.cost <= s.budget, rupees(r.cost), "Concrete, steel and formwork all grow with size. The cheapest section is the smallest that passes every other check."),
    ];
    return {
      readings: [
        gauge("moment", "Capacity ÷ demand", r.muCapKnm / r.muKnm, `${fmt(r.muCapKnm / r.muKnm, 2)}×`, { min: 0, max: 3, low: 1 }),
        gauge("cost", "Cost", r.cost, rupees(r.cost), { min: 0, max: s.budget * 1.8, high: s.budget }),
        info("steel", "Steel provided", `${fmt(r.astMm2, 0)} mm² (${fmt((r.astMm2 / (Number(st.b) * Number(st.D))) * 100, 2)}%)`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
    };
  },
  explain(s, st) {
    const r = analyseBeam(inputOf(s, st));
    return `Your ${st.b} × ${st.D} mm beam with ${st.n} bars of ${st.dia} mm has a capacity of ${fmt(r.muCapKnm, 0)} kN·m against ${fmt(r.muKnm, 0)} kN·m demanded, and costs ${rupees(r.cost)}. It is under-reinforced, so if overloaded the steel yields and the beam cracks and sags visibly before it fails. That ductile warning is the main aim of the limit state method.`;
  },
  fallback: (s) => ({ title: `Size a ${s.spanM} m floor beam`, story: `A builder is framing a slab over a ${s.spanM} m opening. The engineer must choose the beam's size and steel so it is safe, stiff and within the budget.` }),
};
export default defineLab(lab);
