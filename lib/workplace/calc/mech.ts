import type { CalcDraft, CalcField, CalcParam, CalcTemplate } from "./types";
import { relTol } from "./types";
import type { Rng } from "@/lib/workplace/rng";

/**
 * Mechanical Design Engineer (MECH-01) calculation tickets: statics, stress, fits, power transmission, materials, fasteners. Every ticket is a
 * worksheet with seeded numbers and a formula sheet; educational only, never the verification of a real design.
 */

const MAX_TRIES = 80;
/** A wrong-method answer must sit further than this many tolerances from the right one, or the ticket is ambiguous and is redrawn. */
const SEPARATION = 2.5;

interface Spec extends Omit<CalcDraft, "key"> {
  expected: Record<string, number>;
  /** absolute tolerance per field; default is 2% of the expected value */
  tol?: Record<string, number>;
  /** answers a common mistake would give, per field; they must not be accepted */
  traps?: Record<string, number[]>;
}

/** Redraws until the numbers are usable: finite answers, no wrong-method answer inside tolerance, no decision sitting on its boundary (gen returns null). */
export function checked(rng: Rng, gen: (rng: Rng) => Spec | null): CalcDraft {
  for (let i = 0; i < MAX_TRIES; i++) {
    const s = gen(rng);
    if (!s) continue;
    const tolerance = Object.fromEntries(s.fields.map((f) => [f.key, s.tol?.[f.key] ?? relTol(s.expected[f.key])]));
    const finite = s.fields.every((f) => Number.isFinite(s.expected[f.key]) && Number.isFinite(tolerance[f.key]));
    const separated = Object.entries(s.traps ?? {}).every(([k, vals]) => vals.every((v) => Math.abs(v - s.expected[k]) > SEPARATION * tolerance[k]));
    if (!finite || !separated) continue;
    const { expected, tol: _t, traps: _p, ...draft } = s;
    return { ...draft, key: { expected, tolerance } };
  }
  throw new Error("calc template could not draw an unambiguous ticket");
}

const P = (label: string, value: number | string, unit: string): CalcParam => ({ label, value: String(value), unit });
const F = (key: string, label: string, unit: string): CalcField => ({ key, label, unit });
const who = (name: string, title: string) => ({ name, title });
const PI = Math.PI;
const disc = (d: number) => (PI * d * d) / 4;

const tpl = (id: string, area: string, difficulty: "easy" | "medium", gen: (rng: Rng) => Spec | null): CalcTemplate => ({
  id, areas: [area], difficulty, minLevel: "fresher", build: (rng) => checked(rng, gen),
});

const STATICS = "mech-statics-and-loads";
const STRESS = "mech-stress-and-strength";
const FITS = "mech-fits-and-tolerances";
const POWER = "mech-power-transmission";
const MATERIALS = "mech-materials-and-selection";
const FASTENERS = "mech-fasteners";

/** Fictional materials: base yield (MPa), density (kg/m3), cost (INR/kg). Seeded values vary +-10% so no two tickets match. */
const MATERIAL_BASE = [
  ["Mild steel", 250, 7850, 65], ["Medium-carbon steel", 380, 7850, 85], ["Aluminium alloy", 240, 2700, 240], ["Titanium alloy", 880, 4500, 3200],
] as const;

function materialSpec(rng: Rng, mode: "cheapest" | "lightest"): Spec | null {
  const mats = MATERIAL_BASE.map(([name, y, d, c]) => ({ name, y: Math.round(y * (0.9 + rng.int(0, 20) / 100)), d, c: Math.round(c * (0.9 + rng.int(0, 20) / 100)) }));
  const area = rng.int(10, 40) * 10;
  const force = rng.int(20, 90);
  const len = rng.int(2, 6) / 2;
  const req = (force * 1000 * 2) / area;
  if (mats.some((m) => Math.abs(m.y - req) / req < 0.08)) return null;
  const ok = mats.filter((m) => m.y >= req);
  if (ok.length < 2) return null;
  const mass = (m: { d: number }) => m.d * area * 1e-6 * len;
  const score = (m: { d: number; c: number }) => (mode === "cheapest" ? mass(m) * m.c : mass(m));
  const ranked = [...ok].sort((a, b) => score(a) - score(b));
  if (score(ranked[1]) / score(ranked[0]) < 1.1) return null;
  const best = ranked[0];
  const params = [P("Rod force", force, "kN"), P("Rod cross-section area", area, "mm2"), P("Rod length", len, "m"), P("Required factor of safety", 2, ""),
    ...mats.flatMap((m) => [P(`${m.name} yield strength`, m.y, "MPa"), P(`${m.name} density`, m.d, "kg/m3"), P(`${m.name} cost`, m.c, "INR/kg")])];
  const common = { requester: who("Rohit Menon", "Design Lead, Vaayu Gears Pvt Ltd"), params, reference: ["Required yield = FoS x F / A", "A material is feasible if its yield >= required yield", "Mass = density x A x L (A in m2: mm2 x 1e-6)", "Cost = mass x cost per kg"] };
  if (mode === "cheapest") {
    return { ...common, title: "Cheapest rod that holds the load", scenario: "A tie rod carries a steady pull. Four candidate materials are on the supplier sheet. Find the stress the rod must be able to take, how many materials qualify, and what the cheapest qualifying rod costs.",
      fields: [F("req", "Required yield strength", "MPa"), F("count", "Materials that qualify", ""), F("cost", "Cost of the cheapest qualifying rod", "INR")],
      expected: { req, count: ok.length, cost: score(best) }, tol: { count: 0.01 }, traps: { cost: [Math.min(...mats.map((m) => mass(m) * m.c))] } };
  }
  return { ...common, title: "Lightest rod that holds the load", scenario: "The same tie rod is on a moving part, so weight matters more than price. Find how many materials qualify and the mass of the lightest qualifying rod.",
    fields: [F("count", "Materials that qualify", ""), F("mass", "Mass of the lightest qualifying rod", "kg")],
    expected: { count: ok.length, mass: mass(best) }, tol: { count: 0.01 }, traps: { mass: [Math.min(...mats.map(mass))] } };
}

export const MECH_CALC_TEMPLATES: CalcTemplate[] = [
  tpl("mech-ss-point-load", STATICS, "easy", (rng) => {
    const L = rng.int(4, 12) / 2, a = rng.int(1, 2 * L - 1) / 2, load = rng.int(10, 60);
    const ra = (load * (L - a)) / L, rb = (load * a) / L;
    return { title: "Support reactions of a beam", requester: who("Anil Shetty", "Senior Engineer, Kaveri Fabrication Works"),
      scenario: "A simple beam rests on a pin at A and a roller at B and carries one point load. Find the two support reactions.",
      params: [P("Span", L, "m"), P("Load distance from A", a, "m"), P("Point load", load, "kN")], fields: [F("ra", "Reaction at A", "kN"), F("rb", "Reaction at B", "kN")],
      reference: ["Sum of moments about B = 0 gives RA = P (L - a) / L", "Sum of vertical forces = 0 gives RB = P - RA"],
      expected: { ra, rb }, traps: { ra: [rb], rb: [ra] } };
  }),
  tpl("mech-cantilever-udl", STATICS, "easy", (rng) => {
    const w = rng.int(5, 20), L = rng.int(3, 8) / 2;
    return { title: "Wall reaction of a cantilever shelf", requester: who("Meera Joshi", "Design Engineer, Kaveri Fabrication Works"),
      scenario: "A cantilever arm fixed in a wall carries an evenly spread load along its whole length. Find the vertical reaction and the fixed-end moment at the wall.",
      params: [P("Uniform load", w, "kN/m"), P("Length", L, "m")], fields: [F("r", "Vertical reaction at the wall", "kN"), F("m", "Fixed-end moment", "kN.m")],
      reference: ["Resultant of a uniform load = w x L, acting at L / 2", "R = w L", "M = w L x (L / 2) = w L^2 / 2"],
      expected: { r: w * L, m: (w * L * L) / 2 }, traps: { m: [w * L, w * L * L] } };
  }),
  tpl("mech-ss-udl-plus-point", STATICS, "medium", (rng) => {
    const w = rng.int(4, 15), L = rng.int(4, 10) / 2, load = rng.int(8, 40);
    return { title: "Peak bending moment on a loaded beam", requester: who("Anil Shetty", "Senior Engineer, Kaveri Fabrication Works"),
      scenario: "A simply supported beam carries an evenly spread load along its span and one extra load at mid-span. Find the support reaction and the largest bending moment, which is at mid-span.",
      params: [P("Span", L, "m"), P("Uniform load", w, "kN/m"), P("Mid-span point load", load, "kN")], fields: [F("r", "Reaction at each support", "kN"), F("m", "Maximum bending moment", "kN.m")],
      reference: ["By symmetry RA = RB = (w L + P) / 2", "M_max = w L^2 / 8 + P L / 4"],
      expected: { r: (w * L + load) / 2, m: (w * L * L) / 8 + (load * L) / 4 }, traps: { m: [(w * L * L) / 8, (load * L) / 4] } };
  }),
  tpl("mech-rod-axial-stress", STRESS, "easy", (rng) => {
    const d = rng.int(10, 30), force = rng.int(10, 60), sy = rng.pick([250, 350, 420]);
    const stress = (force * 1000) / disc(d), fos = sy / stress;
    if (Math.abs(fos - 2) / 2 < 0.1) return null;
    return { title: "Is the hanger rod strong enough", requester: who("Kiran Rao", "Stress Engineer, Vaayu Gears Pvt Ltd"),
      scenario: "A round rod hangs a machine. Find the tensile stress in it, its factor of safety against yielding, and whether it meets the required factor of safety of 2 (enter 1 if it does, 0 if it does not).",
      params: [P("Axial force", force, "kN"), P("Rod diameter", d, "mm"), P("Yield strength", sy, "MPa"), P("Required factor of safety", 2, "")],
      fields: [F("stress", "Tensile stress", "MPa"), F("fos", "Factor of safety", ""), F("ok", "Meets the requirement (1 or 0)", "")],
      reference: ["A = pi d^2 / 4", "stress = F / A (F in N, A in mm2 gives MPa)", "FoS = yield strength / stress"],
      expected: { stress, fos, ok: fos >= 2 ? 1 : 0 }, tol: { ok: 0.01 }, traps: { stress: [(force * 1000) / disc(d / 2)] } };
  }),
  tpl("mech-pin-double-shear", STRESS, "easy", (rng) => {
    const force = rng.int(10, 80), d = rng.int(8, 24), allow = 60;
    return { title: "Clevis pin in double shear", requester: who("Kiran Rao", "Stress Engineer, Vaayu Gears Pvt Ltd"),
      scenario: "A clevis pin is cut across two planes by the load. Find the shear stress in the pin and the smallest pin diameter that keeps the shear stress at or under the allowable value.",
      params: [P("Pin load", force, "kN"), P("Pin diameter", d, "mm"), P("Allowable shear stress", allow, "MPa")],
      fields: [F("tau", "Shear stress in the pin", "MPa"), F("dmin", "Smallest allowable diameter", "mm")],
      reference: ["Double shear: two cross-sections carry the load", "tau = F / (2 x pi d^2 / 4)", "d_min = sqrt(4 F / (2 pi tau_allow))"],
      expected: { tau: (force * 1000) / (2 * disc(d)), dmin: Math.sqrt((4 * force * 1000) / (2 * PI * allow)) },
      traps: { tau: [(force * 1000) / disc(d)], dmin: [Math.sqrt((4 * force * 1000) / (PI * allow))] } };
  }),
  tpl("mech-beam-bending-stress", STRESS, "medium", (rng) => {
    const load = rng.int(5, 30), L = rng.int(2, 6) / 2, b = rng.int(3, 6) * 10, h = rng.int(6, 12) * 10;
    const m = (load * L) / 4;
    return { title: "Bending stress in a rectangular beam", requester: who("Meera Joshi", "Design Engineer, Kaveri Fabrication Works"),
      scenario: "A simply supported rectangular steel bar carries a single load at mid-span, standing on its taller side. Find the largest bending moment and the largest bending stress.",
      params: [P("Mid-span load", load, "kN"), P("Span", L, "m"), P("Section width b", b, "mm"), P("Section depth h", h, "mm")],
      fields: [F("m", "Maximum bending moment", "kN.m"), F("sigma", "Maximum bending stress", "MPa")],
      reference: ["M_max = P L / 4", "Section modulus Z = b h^2 / 6", "sigma = M / Z (M in N.mm gives MPa)"],
      expected: { m, sigma: (m * 1e6 * 6) / (b * h * h) }, traps: { sigma: [(m * 1e6 * 6) / (h * b * b)] } };
  }),
  tpl("mech-beam-deflection", STRESS, "medium", (rng) => {
    const load = rng.int(2, 12), L = rng.int(8, 20) * 100, b = rng.int(2, 4) * 10, h = rng.int(3, 6) * 10, E = 200000;
    const I = (b * h ** 3) / 12;
    return { title: "Mid-span deflection of a steel bar", requester: who("Kiran Rao", "Stress Engineer, Vaayu Gears Pvt Ltd"),
      scenario: "A simply supported steel bar of rectangular section carries a load at mid-span. Find the second moment of area of the section and the deflection under the load.",
      params: [P("Mid-span load", load, "kN"), P("Span", L, "mm"), P("Section width b", b, "mm"), P("Section depth h", h, "mm"), P("Elastic modulus E", E, "MPa")],
      fields: [F("i", "Second moment of area I", "mm4"), F("delta", "Deflection at mid-span", "mm")],
      reference: ["I = b h^3 / 12", "delta = P L^3 / (48 E I) for a central point load (P in N)"],
      expected: { i: I, delta: (load * 1000 * L ** 3) / (48 * E * I) }, traps: { delta: [(load * 1000 * L ** 3) / (3 * E * I)] } };
  }),
  tpl("mech-tolerance-stack", FITS, "easy", (rng) => {
    const t = () => rng.int(1, 6) * 0.05;
    const parts = [rng.int(20, 60), rng.int(15, 40), rng.int(10, 30)], tols = [t(), t(), t()], ht = t();
    const housing = parts[0] + parts[1] + parts[2] + rng.int(5, 20) / 10;
    const all = [...tols, ht];
    const wc = all.reduce((s, x) => s + x, 0), rss = Math.sqrt(all.reduce((s, x) => s + x * x, 0));
    return { title: "Gap left in the housing", requester: who("Divya Nair", "Quality Engineer, Kaveri Fabrication Works"),
      scenario: "Three parts are stacked end to end inside a housing. Every dimension carries a plus/minus tolerance. Find the nominal gap left over, and the tolerance on that gap by the worst-case method and by the root-sum-square method.",
      params: [P("Housing inner length", housing.toFixed(1), "mm"), P("Housing tolerance", ht.toFixed(2), "mm"), P("Part 1 length", parts[0], "mm"), P("Part 1 tolerance", tols[0].toFixed(2), "mm"),
        P("Part 2 length", parts[1], "mm"), P("Part 2 tolerance", tols[1].toFixed(2), "mm"), P("Part 3 length", parts[2], "mm"), P("Part 3 tolerance", tols[2].toFixed(2), "mm")],
      fields: [F("gap", "Nominal gap", "mm"), F("wc", "Worst-case tolerance on the gap (+/-)", "mm"), F("rss", "RSS tolerance on the gap (+/-)", "mm")],
      reference: ["Gap = housing - (part 1 + part 2 + part 3)", "Worst case: tolerance = sum of all tolerances", "RSS: tolerance = square root of the sum of the squared tolerances"],
      expected: { gap: housing - parts[0] - parts[1] - parts[2], wc, rss }, tol: { gap: 0.01, wc: 0.01, rss: 0.01 }, traps: { rss: [wc] } };
  }),
  tpl("mech-hole-shaft-fit", FITS, "medium", (rng) => {
    const D = rng.int(20, 40), hu = rng.pick([0.021, 0.025, 0.03, 0.033, 0.039]), es = rng.pick([-0.02, -0.007, -0.04, 0.015, 0.028, 0.035]), it = rng.pick([0.013, 0.016, 0.021]);
    const maxC = hu - (es - it), minC = -es;
    if (Math.abs(maxC) < 0.005 || Math.abs(minC) < 0.005) return null;
    const kind = minC > 0 ? 1 : maxC < 0 ? 3 : 2;
    return { title: "Clearance or interference of a shaft fit", requester: who("Divya Nair", "Quality Engineer, Kaveri Fabrication Works"),
      scenario: "A shaft is made to fit a bored hole. Using the limits below, find the loosest and tightest the fit can be (a negative number is interference), and classify it: 1 for clearance, 2 for transition, 3 for interference.",
      params: [P("Nominal size", D, "mm"), P("Hole upper deviation", hu.toFixed(3), "mm"), P("Hole lower deviation", "0.000", "mm"), P("Shaft upper deviation", es.toFixed(3), "mm"), P("Shaft tolerance band", it.toFixed(3), "mm")],
      fields: [F("maxc", "Maximum clearance", "mm"), F("minc", "Minimum clearance", "mm"), F("kind", "Fit type (1, 2 or 3)", "")],
      reference: ["Largest hole = nominal + hole upper deviation; smallest shaft = nominal + shaft upper deviation - tolerance band", "Maximum clearance = largest hole - smallest shaft", "Minimum clearance = smallest hole - largest shaft", "All clearances positive = clearance fit; all negative = interference fit; else transition"],
      expected: { maxc: maxC, minc: minC, kind }, tol: { maxc: 0.0006, minc: 0.0006, kind: 0.01 }, traps: { minc: [es] } };
  }),
  tpl("mech-gear-train", POWER, "easy", (rng) => {
    const n1 = rng.int(15, 30), n2 = rng.int(40, 90), rpm = rng.int(6, 15) * 100, t = rng.int(5, 30), eta = rng.int(95, 98) / 100;
    return { title: "Output of a single gear stage", requester: who("Suresh Pillai", "Mechanical Engineer, Vaayu Gears Pvt Ltd"),
      scenario: "A motor drives a pinion that meshes with a larger gear. Find the speed ratio, the output shaft speed and the output torque including the mesh efficiency.",
      params: [P("Pinion teeth", n1, ""), P("Gear teeth", n2, ""), P("Motor speed", rpm, "rpm"), P("Motor torque", t, "N.m"), P("Mesh efficiency", eta, "")],
      fields: [F("ratio", "Speed ratio (gear teeth / pinion teeth)", ""), F("n", "Output speed", "rpm"), F("t", "Output torque", "N.m")],
      reference: ["ratio = N_gear / N_pinion", "output speed = input speed / ratio", "output torque = input torque x ratio x efficiency"],
      expected: { ratio: n2 / n1, n: (rpm * n1) / n2, t: (t * (n2 / n1) * eta) }, traps: { n: [(rpm * n2) / n1] } };
  }),
  tpl("mech-belt-speed", POWER, "easy", (rng) => {
    const d1 = rng.int(4, 10) * 25, k = rng.int(3, 6) / 2, n1 = rng.pick([720, 960, 1440]);
    return { title: "Belt speed and driven pulley speed", requester: who("Suresh Pillai", "Mechanical Engineer, Vaayu Gears Pvt Ltd"),
      scenario: "A flat belt joins a motor pulley to a larger driven pulley. Ignore belt slip. Find the belt speed and the driven pulley speed.",
      params: [P("Driver pulley diameter", d1, "mm"), P("Driven pulley diameter", d1 * k, "mm"), P("Driver speed", n1, "rpm")],
      fields: [F("v", "Belt speed", "m/s"), F("n2", "Driven pulley speed", "rpm")],
      reference: ["v = pi D N / 60 (D in m, N in rpm gives m/s)", "N_driven = N_driver x D_driver / D_driven"],
      expected: { v: (PI * (d1 / 1000) * n1) / 60, n2: n1 / k }, traps: { n2: [n1 * k] } };
  }),
  tpl("mech-shaft-torque-stress", POWER, "medium", (rng) => {
    const kw = rng.int(2, 15), n = rng.int(3, 15) * 100, d = rng.int(20, 50);
    const t = (60000 * kw) / (2 * PI * n);
    return { title: "Torque and shear stress in a drive shaft", requester: who("Suresh Pillai", "Mechanical Engineer, Vaayu Gears Pvt Ltd"),
      scenario: "A solid round shaft transmits steady power at constant speed. Find the torque it carries and the shear stress at its surface.",
      params: [P("Power", kw, "kW"), P("Shaft speed", n, "rpm"), P("Shaft diameter", d, "mm")], fields: [F("t", "Torque", "N.m"), F("tau", "Surface shear stress", "MPa")],
      reference: ["T = P / omega, with omega = 2 pi N / 60 (P in W)", "tau = 16 T / (pi d^3) (T in N.mm, d in mm gives MPa)"],
      expected: { t, tau: (16 * t * 1000) / (PI * d ** 3) }, traps: { tau: [(16 * t) / (PI * d ** 3)] } };
  }),
  tpl("mech-bearing-l10", POWER, "medium", (rng) => {
    const c = rng.int(10, 40), p = rng.int(2, 8), n = rng.int(5, 15) * 100;
    if (c / p < 2) return null;
    const l10 = (c / p) ** 3;
    return { title: "Basic life of a ball bearing", requester: who("Pooja Iyer", "Maintenance Engineer, Vaayu Gears Pvt Ltd"),
      scenario: "A deep-groove ball bearing carries a steady equivalent load. Find its basic rating life in million revolutions and in operating hours.",
      params: [P("Basic dynamic load rating C", c, "kN"), P("Equivalent load P", p, "kN"), P("Speed", n, "rpm")], fields: [F("l10", "Basic life L10", "million rev"), F("hours", "Basic life in hours", "h")],
      reference: ["L10 = (C / P)^3 for ball bearings, in million revolutions", "L10h = L10 x 1,000,000 / (60 x N)"],
      expected: { l10, hours: (l10 * 1e6) / (60 * n) }, traps: { l10: [(c / p) ** (10 / 3)] } };
  }),
  tpl("mech-material-cheapest", MATERIALS, "easy", (rng) => materialSpec(rng, "cheapest")),
  tpl("mech-material-lightest", MATERIALS, "medium", (rng) => materialSpec(rng, "lightest")),
  tpl("mech-bolt-preload", FASTENERS, "easy", (rng) => {
    const [size, d, at] = rng.pick([["M8", 8, 36.6], ["M10", 10, 58], ["M12", 12, 84.3], ["M16", 16, 157]] as const);
    const [cls, sp] = rng.pick([["4.6", 225], ["8.8", 600], ["10.9", 830]] as const);
    const fi = (0.75 * sp * at) / 1000;
    return { title: "Preload and tightening torque of a bolt", requester: who("Pooja Iyer", "Maintenance Engineer, Vaayu Gears Pvt Ltd"),
      scenario: `A ${size} bolt of class ${cls} clamps a flange and is tightened to 75% of its proof load. Find the preload and the wrench torque to reach it.`,
      params: [P("Bolt nominal diameter", d, "mm"), P("Tensile stress area", at, "mm2"), P("Proof strength", sp, "MPa"), P("Torque coefficient K", 0.2, "")],
      fields: [F("fi", "Preload", "kN"), F("t", "Tightening torque", "N.m")],
      reference: ["F_i = 0.75 x proof strength x tensile stress area", "T = K x F_i x d (F_i in N, d in m gives N.m)"],
      expected: { fi, t: 0.2 * fi * d }, traps: { fi: [(0.9 * sp * at) / 1000], t: [fi * d] } };
  }),
  tpl("mech-bolt-shear-count", FASTENERS, "medium", (rng) => {
    const d = rng.int(8, 20), tau = rng.int(10, 16) * 10, n = rng.int(2, 8), load = rng.int(20, 120);
    const cap = (tau * disc(d)) / 1000, need = load / cap;
    const frac = need - Math.floor(need);
    if (frac < 0.15 || frac > 0.85) return null;
    return { title: "How many bolts the shear joint needs", requester: who("Pooja Iyer", "Maintenance Engineer, Vaayu Gears Pvt Ltd"),
      scenario: "A lap joint carries a shear load across its bolts, each in single shear. Find what one bolt can carry, what the joint with its fitted bolts can carry, and how many bolts the load needs.",
      params: [P("Bolt diameter", d, "mm"), P("Allowable shear stress", tau, "MPa"), P("Bolts fitted", n, ""), P("Shear load on the joint", load, "kN")],
      fields: [F("cap", "Capacity of one bolt", "kN"), F("total", "Capacity of the fitted bolts", "kN"), F("need", "Bolts needed for the load", "")],
      reference: ["Single shear: capacity = tau_allow x pi d^2 / 4", "Joint capacity = bolts x capacity of one bolt", "Bolts needed = load / capacity of one, rounded up to a whole bolt"],
      expected: { cap, total: n * cap, need: Math.ceil(need) }, tol: { need: 0.01 }, traps: { need: [Math.floor(need)] } };
  }),
];
