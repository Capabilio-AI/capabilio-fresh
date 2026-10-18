import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Simply supported rectangular beam, point load at midspan or a uniformly distributed load. Self-weight is not added to the load.
interface S { span: number; kind: "point" | "udl"; load: number; sfMin: number; deflDiv: number; massMax: number; budget: number }

const MATERIALS: Record<string, { name: string; e: number; sy: number; rho: number; price: number }> = {
  steel: { name: "Mild steel", e: 200_000, sy: 250, rho: 7850, price: 70 },
  alu: { name: "Aluminium 6061", e: 69_000, sy: 240, rho: 2700, price: 260 },
  timber: { name: "Sal timber", e: 12_000, sy: 40, rho: 800, price: 90 },
};

function analyse(s: S, st: Settings) {
  const m = MATERIALS[String(st.mat)];
  const b = Number(st.b);
  const h = Number(st.h);
  const L = s.span * 1000;
  const I = (b * h ** 3) / 12;
  const moment = s.kind === "point" ? (s.load * 1000 * L) / 4 : (s.load * L * L) / 8; // N·mm (1 kN/m = 1 N/mm)
  const stress = (moment * (h / 2)) / I;
  const defl = (x: number) => (s.kind === "point" ? (x <= L / 2 ? (s.load * 1000 * x * (3 * L * L - 4 * x * x)) / (48 * m.e * I) : (s.load * 1000 * (L - x) * (3 * L * L - 4 * (L - x) ** 2)) / (48 * m.e * I)) : (s.load * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * m.e * I));
  const mass = (m.rho * b * h * L) / 1e9;
  return { m, stress, sf: m.sy / stress, dmax: defl(L / 2), defl, L, mass, cost: mass * m.price, limit: L / s.deflDiv };
}

const lab: Lab<S> = {
  key: "beam",
  family: "mech",
  format: "simulation",
  name: "Beam workshop",
  topic: "Strength of Materials · Bending of beams",
  keywords: ["strength of materials", "mechanics of solids", "machine design", "bending", "beam", "design of machine"],
  tools: ["Material library", "Section sizes", "Load frame", "Deflection plot"],
  skillTags: ["Bending stress", "Beam deflection", "Factor of safety"],
  makeScenario(rng, d) {
    const kind = rng.pick(["point", "udl"] as const);
    const base: S = {
      span: rng.pick([2, 3, 4, 5, 6]), kind, load: kind === "point" ? rng.int(2, 12) * 5 : rng.int(1, 5) * 5,
      sfMin: d === "easy" ? 1.5 : d === "medium" ? 2 : 2.5, deflDiv: d === "easy" ? 200 : d === "medium" ? 250 : 360, massMax: Infinity, budget: Infinity,
    };
    let mass = Infinity;
    let cost = Infinity;
    for (const st of gridSettings(lab.controls(base))) {
      const a = analyse(base, st);
      if (a.sf >= base.sfMin && a.dmax <= a.limit) {
        mass = Math.min(mass, a.mass);
        cost = Math.min(cost, a.cost);
      }
    }
    const k = d === "easy" ? 3 : d === "medium" ? 1.8 : 1.4;
    return { ...base, massMax: Number.isFinite(mass) ? Math.ceil(mass * k) : 100, budget: Number.isFinite(cost) ? Math.ceil((cost * k) / 50) * 50 : 5000 };
  },
  given: (s) => [
    { label: "Span", value: `${s.span} m, simply supported` },
    { label: "Load", value: s.kind === "point" ? `${s.load} kN at midspan` : `${s.load} kN/m along the span` },
    { label: "Limits", value: `factor of safety ≥ ${s.sfMin}, deflection ≤ span/${s.deflDiv}, mass ≤ ${fmt(s.massMax, 0)} kg, cost ≤ ${rupees(s.budget)}` },
  ],
  mission: (s) => `Choose a material and a rectangular section so the beam is safe, stiff enough, light enough (${fmt(s.massMax, 0)} kg) and within ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "choice", id: "mat", label: "Material", options: Object.entries(MATERIALS).map(([value, m]) => ({ value, label: m.name })), default: "timber" },
    { kind: "choice", id: "b", label: "Breadth", options: choices([50, 75, 100, 150], (v) => `${v} mm`), default: "50" },
    { kind: "choice", id: "h", label: "Depth", options: choices([75, 100, 150, 200, 250, 300], (v) => `${v} mm`), default: "75" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("sf", `Factor of safety ≥ ${s.sfMin}`, a.sf >= s.sfMin, `${fmt(a.sf)} (stress ${fmt(a.stress, 1)} MPa of ${a.m.sy} MPa)`, "Bending stress is M·c/I. Which dimension of the section enters I with the highest power?"),
      objective("defl", `Deflection ≤ span/${s.deflDiv} (${fmt(a.limit, 1)} mm)`, a.dmax <= a.limit, `${fmt(a.dmax, 1)} mm`, "Deflection depends on stiffness E·I, not strength. Is the material stiff, and is the section deep?"),
      objective("mass", `Mass ≤ ${fmt(s.massMax, 0)} kg`, a.mass <= s.massMax, `${fmt(a.mass, 1)} kg`, "Mass grows with the area of the section and the density of the material."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Price per kilogram differs a lot between materials. Which one is costing you most?"),
    ];
    const pts = Array.from({ length: 25 }, (_, i): [number, number] => [(a.L * i) / 24 / 1000, a.defl((a.L * i) / 24)]);
    return {
      readings: [
        gauge("sf", "Factor of safety", Math.min(a.sf, 10), fmt(a.sf), { min: 0, max: 10, low: s.sfMin }),
        gauge("defl", "Maximum deflection", a.dmax, `${fmt(a.dmax, 1)} mm`, { min: 0, max: Math.max(a.limit * 3, a.dmax * 1.1), high: a.limit }),
        gauge("mass", "Mass", a.mass, `${fmt(a.mass, 1)} kg`, { min: 0, max: Math.max(s.massMax * 1.5, a.mass * 1.1), high: s.massMax }),
        gauge("cost", "Cost", a.cost, rupees(a.cost), { min: 0, max: Math.max(s.budget * 1.5, a.cost * 1.1), high: s.budget }),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Deflected shape", xLabel: "position along the beam (m)", yLabel: "deflection (mm)", lines: [{ name: "Deflection", pts, style: "main" }, { name: "Allowed", pts: [[0, a.limit], [s.span, a.limit]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The maximum bending moment is ${s.kind === "point" ? "PL/4" : "wL²/8"}, giving a stress of M·c/I = ${fmt(a.stress, 1)} MPa against ${a.m.sy} MPa for ${a.m.name.toLowerCase()}. The second moment of area I = bh³/12 grows with the cube of the depth, so making a section deeper is far more effective than making it wider. Deflection depends on E·I, so a stiff material in a deep section controls it, while mass and cost trade against strength: aluminium is light but pricey, timber is cheap but weak and flexible, steel sits between.`;
  },
  fallback: (s) => ({
    title: `Beam for a ${s.span} m ${s.kind === "point" ? "lifting rig" : "storage platform"}`,
    story: `A small workshop needs a ${s.span} m beam to carry ${s.kind === "point" ? "a hoist" : "stacked crates"}. The last beam sagged until the owner refused to walk under it, and the budget is tight.`,
  }),
};
export default defineLab(lab);
