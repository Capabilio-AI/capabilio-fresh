import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Short axially loaded RCC column, IS 456 cl. 39.3: Pu = 0.4·fck·Ac + 0.67·fy·Asc, steel 0.8%–4% of the section, le/b ≤ 12.
interface S { height: number; demand: number; budget: number }

const FY = 500;
const FCK: Record<string, number> = { M20: 20, M25: 25, M30: 30, M40: 40 };
const CONCRETE: Record<string, number> = { M20: 6200, M25: 6700, M30: 7300, M40: 8200 }; // ₹/m³
const STEEL = 70; // ₹/kg incl. laps
const FORM = 450; // ₹/m²

function analyse(s: S, st: Settings) {
  const b = Number(st.b);
  const dia = Number(st.dia);
  const n = Number(st.n);
  const grade = String(st.grade);
  const asc = (n * Math.PI * dia * dia) / 4;
  const ac = b * b - asc;
  const cap = (0.4 * FCK[grade] * ac + 0.67 * FY * asc) / 1000; // kN
  const pct = (asc / (b * b)) * 100;
  const slender = (0.8 * s.height * 1000) / b;
  const cost = (b / 1000) ** 2 * s.height * CONCRETE[grade] + asc * 1e-6 * s.height * 7850 * STEEL + ((4 * b) / 1000) * s.height * FORM;
  return { asc, cap, pct, slender, cost, use: s.demand / cap };
}

const lab: Lab<S> = {
  key: "rcc-column",
  family: "civil",
  format: "simulation",
  name: "Structural design desk",
  topic: "RCC Design · Axially loaded columns",
  keywords: ["rcc", "reinforced concrete", "concrete", "structural design", "design of structures", "column"],
  tools: ["Concrete grades", "Reinforcement bars", "Section sizes", "Utilisation check"],
  skillTags: ["RCC columns", "Reinforcement limits", "Axial capacity"],
  makeScenario(rng, d) {
    const base: S = { height: rng.pick([3, 3.3, 3.6, 4]), demand: rng.int(6, d === "hard" ? 30 : 22) * 100, budget: Infinity };
    let cheapest = Infinity;
    for (const st of gridSettings(lab.controls(base))) {
      const a = analyse(base, st);
      if (a.cap >= base.demand && a.pct >= 0.8 && a.pct <= 4 && a.slender <= 12) cheapest = Math.min(cheapest, a.cost);
    }
    return { ...base, budget: Number.isFinite(cheapest) ? Math.ceil((cheapest * (d === "easy" ? 1.6 : d === "medium" ? 1.25 : 1.06)) / 100) * 100 : 20000 };
  },
  given: (s) => [
    { label: "Factored axial load", value: `${s.demand} kN` },
    { label: "Storey height", value: `${s.height} m, effective length 0.8 × height` },
    { label: "Steel", value: "Fe 500" },
    { label: "Budget", value: rupees(s.budget) },
  ],
  mission: (s) => `Design a square column that safely carries ${s.demand} kN, keeps steel within the code limits, stays a short column and costs under ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "choice", id: "b", label: "Column size (square)", options: choices([230, 300, 350, 400, 450, 500], (v) => `${v} × ${v} mm`), default: "230" },
    { kind: "choice", id: "grade", label: "Concrete grade", options: choices(Object.keys(FCK)), default: "M20" },
    { kind: "choice", id: "n", label: "Number of bars", options: choices([4, 6, 8, 12]), default: "4" },
    { kind: "choice", id: "dia", label: "Bar diameter", options: choices([12, 16, 20, 25], (v) => `${v} mm`), default: "12" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("cap", `Capacity ≥ ${s.demand} kN`, a.cap >= s.demand, `${fmt(a.cap, 0)} kN (${fmt(a.use * 100, 0)}% used)`, "Both the concrete area and the steel area carry load. Which of the two do you have more room to add?"),
      objective("steel", "Steel between 0.8% and 4% of the section", a.pct >= 0.8 && a.pct <= 4, `${fmt(a.pct, 2)}%`, "Too little steel and the column fails brittlely; too much cannot be placed or compacted. Check the percentage."),
      objective("short", "Short column (effective length / size ≤ 12)", a.slender <= 12, `${fmt(a.slender, 1)}`, "A slender column buckles before it crushes. A larger section brings the ratio down."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Concrete grade, section size and steel all cost money. Which of them is bigger than it needs to be?"),
    ];
    return {
      readings: [
        gauge("use", "Load used", Math.min(a.use * 100, 200), `${fmt(a.use * 100, 0)}% of capacity`, { min: 0, max: 200, high: 100 }),
        gauge("pct", "Steel percentage", a.pct, `${fmt(a.pct, 2)}%`, { min: 0, max: 6, low: 0.8, high: 4 }),
        gauge("cost", "Cost", a.cost, rupees(a.cost), { min: 0, max: Math.max(s.budget * 1.5, a.cost * 1.1), high: s.budget }),
        info("verdict", "Verdict", a.use <= 1 ? "SAFE" : "UNSAFE"),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `IS 456 gives the axial strength of a short column as Pu = 0.4·fck·Ac + 0.67·fy·Asc. Here the concrete contributes ${fmt(0.4 * FCK[String(st.grade)] * (Number(st.b) ** 2 - a.asc) / 1000, 0)} kN and the ${fmt(a.asc, 0)} mm² of steel ${fmt(0.67 * FY * a.asc / 1000, 0)} kN, a total of ${fmt(a.cap, 0)} kN against a demand of ${s.demand} kN. The code limits steel to 0.8–4% so the column is neither brittle nor impossible to cast. A larger section carries more load cheaply because concrete is cheaper per kN than steel, but formwork and size grow, so the best design balances the three.`;
  },
  fallback: (s) => ({
    title: `Design a ${s.demand} kN ground-floor column`,
    story: `A small apartment block's ground-floor column keeps getting rejected at plan check. The site engineer has to propose a section, concrete grade and reinforcement that the checker will accept, within what the owner can pay.`,
  }),
};
export default defineLab(lab);
