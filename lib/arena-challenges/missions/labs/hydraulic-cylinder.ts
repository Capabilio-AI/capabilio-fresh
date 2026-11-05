import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Industrial Hydraulics and Pneumatics: F = p·A·η, v = Q/A, hydraulic power = p·Q.
interface S { loadKn: number; speedMmS: number; powerKw: number; budget: number }

const BORE = [40, 50, 63, 80, 100, 125, 160];
const BAR = [60, 80, 100, 120, 140, 160, 180, 210, 250];
const FLOW = [5, 8, 12, 16, 25, 40, 63, 80];
const cost = (st: Settings) => 18_000 + 220 * Number(st.bore) + 110 * Number(st.bar) + 1300 * Number(st.flow);

function analyse(s: S, st: Settings) {
  const area = (Math.PI * (Number(st.bore) / 1000) ** 2) / 4;
  const p = Number(st.bar) * 1e5;
  const q = Number(st.flow) / 60000;
  return { force: (p * area * 0.92) / 1000, speed: (q / area) * 1000, power: (p * q) / 1000, cost: cost(st), area, p, q };
}

const lab: Lab<S> = {
  key: "hydraulic-cylinder",
  family: "mech",
  format: "simulation",
  name: "Hydraulic press bench",
  topic: "Industrial Hydraulics and Pneumatics · Cylinder and pump sizing",
  keywords: ["hydraulics", "pneumatics", "fluid mechanics", "hydraulic machines", "industrial", "actuators", "robotics"],
  tools: ["Cylinder bore", "Pump pressure setting", "Pump flow", "Force–speed chart"],
  skillTags: ["Pascal's law", "Cylinder force and speed", "Hydraulic power"],
  makeScenario(rng, d) {
    const base: S = { loadKn: 0, speedMmS: 0, powerKw: 0, budget: 0 };
    const ref = rng.pick([...gridSettings(lab.controls(base))].filter((st) => analyse(base, st).force > 8 && analyse(base, st).speed > 15));
    const a = analyse(base, ref);
    const k = d === "easy" ? 0.6 : d === "medium" ? 0.8 : 0.95;
    return { loadKn: Math.floor(a.force * k), speedMmS: Math.floor(a.speed * k), powerKw: Number((a.power * (d === "easy" ? 1.8 : d === "medium" ? 1.25 : 1.05)).toFixed(1)), budget: Math.ceil((a.cost * (d === "easy" ? 1.5 : d === "medium" ? 1.2 : 1.05)) / 1000) * 1000 };
  },
  given: (s) => [{ label: "Load", value: `${s.loadKn} kN` }, { label: "Speed", value: `at least ${s.speedMmS} mm/s` }, { label: "Motor", value: `${s.powerKw} kW hydraulic output at most` }, { label: "Budget", value: rupees(s.budget) }],
  mission: (s) => `Size the cylinder and pump to push ${s.loadKn} kN at ${s.speedMmS} mm/s using no more than ${s.powerKw} kW, within ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "choice", id: "bore", label: "Cylinder bore", options: choices(BORE, (v) => `${v} mm`), default: "40" },
    { kind: "choice", id: "bar", label: "Relief pressure setting", options: choices(BAR, (v) => `${v} bar`), default: "60" },
    { kind: "choice", id: "flow", label: "Pump flow", options: choices(FLOW, (v) => `${v} L/min`), default: "5" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("force", `Force ≥ ${s.loadKn} kN`, a.force >= s.loadKn, `${fmt(a.force, 1)} kN`, "Force is pressure times piston area. You can raise either; which is cheaper?"),
      objective("speed", `Speed ≥ ${s.speedMmS} mm/s`, a.speed >= s.speedMmS, `${fmt(a.speed, 0)} mm/s`, "Speed is pump flow divided by piston area. A bigger bore is slower for the same pump."),
      objective("power", `Hydraulic power ≤ ${s.powerKw} kW`, a.power <= s.powerKw, `${fmt(a.power, 1)} kW`, "Power is pressure × flow. It sets the electric motor size."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Larger bore, higher pressure and higher flow all add cost."),
    ];
    const pts: [number, number][] = BORE.map((b) => [b, analyse(s, { ...st, bore: b }).force]);
    return {
      readings: [info("area", "Piston area", `${fmt(a.area * 10000, 1)} cm²`), gauge("f", "Force", a.force, `${fmt(a.force, 1)} kN`, { min: 0, max: Math.max(s.loadKn * 2, a.force * 1.1), low: s.loadKn }), gauge("v", "Speed", a.speed, `${fmt(a.speed, 0)} mm/s`, { min: 0, max: Math.max(s.speedMmS * 2, a.speed * 1.1), low: s.speedMmS })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Force at your pressure for each bore", xLabel: "bore (mm)", yLabel: "force (kN)", lines: [{ name: "Force", pts, style: "main" }, { name: "Load", pts: [[BORE[0], s.loadKn], [BORE[BORE.length - 1], s.loadKn]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `A ${st.bore} mm bore has ${fmt(a.area * 10000, 1)} cm² of piston, so ${st.bar} bar pushes ${fmt(a.force, 1)} kN. The same area turns ${st.flow} L/min into ${fmt(a.speed, 0)} mm/s. Force needs area × pressure while speed needs flow ÷ area, so a bigger bore buys force but costs speed. The product of pressure and flow, ${fmt(a.power, 1)} kW, is what the electric motor must supply.`;
  },
  fallback: (s) => ({ title: `Size the ${s.loadKn} kN baling press`, story: `A recycling yard is building a baling press that must push ${s.loadKn} kN steadily. The motor on site can supply only ${s.powerKw} kW and the workshop has ${rupees(s.budget)}.` }),
};
export default defineLab(lab);
