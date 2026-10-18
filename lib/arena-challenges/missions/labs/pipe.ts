import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Darcy-Weisbach with the Swamee-Jain friction factor, water at 20 °C, minor losses K = 4 for the whole line.
interface S { q: number; length: number; lift: number; pumpHead: number; budget: number }

const NU = 1.0e-6;
const G = 9.81;
const K_MINOR = 4;
const MATERIALS: Record<string, { name: string; eps: number; factor: number }> = {
  pvc: { name: "PVC", eps: 0.0015e-3, factor: 1 },
  steel: { name: "Commercial steel", eps: 0.045e-3, factor: 2.2 },
  ci: { name: "Cast iron", eps: 0.26e-3, factor: 1.8 },
};
const DIAMETERS: Record<number, number> = { 50: 180, 65: 240, 80: 320, 100: 450, 125: 650, 150: 900, 200: 1500 };

function head(q: number, length: number, lift: number, dMm: number, mat: string) {
  const D = dMm / 1000;
  const v = (4 * q) / 1000 / (Math.PI * D * D);
  const re = (v * D) / NU;
  const eps = MATERIALS[mat].eps;
  const f = re < 2300 ? 64 / Math.max(re, 1) : 0.25 / Math.log10(eps / (3.7 * D) + 5.74 / re ** 0.9) ** 2;
  const hf = (f * length * v * v) / (2 * G * D);
  return { v, re, f, hf, total: lift + hf + (K_MINOR * v * v) / (2 * G) };
}

function analyse(s: S, st: Settings) {
  const d = Number(st.d);
  const mat = String(st.mat);
  return { ...head(s.q, s.length, s.lift, d, mat), cost: s.length * DIAMETERS[d] * MATERIALS[mat].factor };
}

const lab: Lab<S> = {
  key: "pipeline",
  family: "mech",
  format: "lab",
  name: "Pipeline bench",
  topic: "Fluid Mechanics · Pipe flow and losses",
  keywords: ["fluid", "hydraulic", "pipe", "pump", "flow"],
  tools: ["Pipe catalogue", "Pump curve", "Flow meter"],
  skillTags: ["Darcy-Weisbach", "Head loss", "Pipe sizing"],
  makeScenario(rng, d) {
    const q = rng.pick([5, 8, 12, 20, 30]);
    const length = rng.pick([300, 500, 800, 1200]);
    const lift = rng.pick([5, 10, 15, 20]);
    const options = Object.keys(DIAMETERS).flatMap((dd) => Object.keys(MATERIALS).map((m) => ({ dd: Number(dd), m })));
    const good = options.filter(({ dd, m }) => {
      const h = head(q, length, lift, dd, m);
      return h.v >= 0.6 && h.v <= 2.5;
    });
    const pick = good.length ? rng.pick(good) : { dd: 100, m: "pvc" };
    const h = head(q, length, lift, pick.dd, pick.m);
    return { q, length, lift, pumpHead: Math.ceil(h.total * (d === "easy" ? 1.4 : d === "medium" ? 1.15 : 1.03)), budget: Math.ceil((length * DIAMETERS[pick.dd] * MATERIALS[pick.m].factor * (d === "easy" ? 1.5 : d === "medium" ? 1.2 : 1.03)) / 1000) * 1000 };
  },
  given: (s) => [
    { label: "Flow", value: `${s.q} L/s of water` },
    { label: "Pipeline", value: `${s.length} m long, ${s.lift} m static lift, fittings add K = ${K_MINOR}` },
    { label: "Pump", value: `delivers at most ${s.pumpHead} m of head` },
    { label: "Budget", value: rupees(s.budget) },
  ],
  mission: (s) => `Choose a pipe diameter and material so the pump can deliver ${s.q} L/s, the water moves at 0.6–2.5 m/s, and the pipe costs under ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "choice", id: "d", label: "Nominal diameter", options: choices(Object.keys(DIAMETERS), (v) => `${v} mm`), default: "50" },
    { kind: "choice", id: "mat", label: "Pipe material", options: Object.entries(MATERIALS).map(([value, m]) => ({ value, label: m.name })), default: "ci" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("head", `Head needed ≤ pump head (${s.pumpHead} m)`, a.total <= s.pumpHead, `${fmt(a.total, 1)} m needed`, "Friction loss grows steeply as the pipe gets narrower. Which dimension has the biggest effect on it?"),
      objective("vel", "Velocity between 0.6 and 2.5 m/s", a.v >= 0.6 && a.v <= 2.5, `${fmt(a.v)} m/s`, "Too slow and sediment settles, too fast and the pipe erodes and the pump works harder. Velocity is flow divided by area."),
      objective("cost", `Pipe cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Wider pipes and tougher materials cost more per metre."),
    ];
    const pts = Array.from({ length: 13 }, (_, i): [number, number] => {
      const q = (s.q * 1.4 * i) / 12;
      return [q, q === 0 ? s.lift : head(q, s.length, s.lift, Number(st.d), String(st.mat)).total];
    });
    return {
      readings: [
        gauge("head", "Head required", a.total, `${fmt(a.total, 1)} m`, { min: 0, max: Math.max(s.pumpHead * 1.5, a.total * 1.1), high: s.pumpHead }),
        gauge("vel", "Velocity", a.v, `${fmt(a.v)} m/s`, { min: 0, max: Math.max(4, a.v * 1.1), low: 0.6, high: 2.5 }),
        gauge("cost", "Pipe cost", a.cost, rupees(a.cost), { min: 0, max: Math.max(s.budget * 1.5, a.cost * 1.1), high: s.budget }),
        info("re", "Reynolds number", fmt(a.re, 0)),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "System curve against the pump", xLabel: "flow (L/s)", yLabel: "head (m)", lines: [{ name: "Head needed", pts, style: "main" }, { name: "Pump head", pts: [[0, s.pumpHead], [s.q * 1.4, s.pumpHead]], style: "limit" }, { name: "Design flow", pts: [[s.q, 0], [s.q, s.pumpHead * 1.2]], style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The pump must lift the water ${s.lift} m and also overcome friction: Darcy-Weisbach gives hf = f·(L/D)·v²/2g = ${fmt(a.hf, 1)} m with f = ${fmt(a.f, 4)} at Re = ${fmt(a.re, 0)}. Because v = Q/A, halving the diameter quadruples the velocity and raises friction loss roughly thirty-two fold, so diameter dominates, while the pipe's roughness matters less. A wider pipe cuts the head and the pumping energy but costs more to buy, which is the trade-off every pipeline design resolves.`;
  },
  fallback: (s) => ({
    title: `Size the ${s.q} L/s supply line`,
    story: `A village water scheme is laying a ${s.length} m line from a tank to the hillside storage. The existing pump is fixed, the panchayat budget is fixed, and the line has to carry the design flow.`,
  }),
};
export default defineLab(lab);
