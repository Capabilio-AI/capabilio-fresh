import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Refrigeration: vapour-compression plant. COP = η_II · Te/(Tc − Te) (second-law efficiency by refrigerant); compressor power = load/COP.
interface S { loadKw: number; roomC: number; ambientC: number; powerMaxKw: number; budget: number }

const TE = [-35, -30, -25, -20, -15, -10, -5, 0, 5];
const DTC = [5, 8, 12, 16, 20];
const REF = { R134a: 0.55, R600a: 0.58, R290: 0.6 } as const;
const cost = (s: S, st: Settings) => 9000 * s.loadKw + 160_000 * s.loadKw / Number(st.dtc) ** 0.7 + 90_000 * s.loadKw / (s.roomC - Number(st.te)) ** 0.7 * 5;

function analyse(s: S, st: Settings) {
  const te = Number(st.te);
  const tc = s.ambientC + Number(st.dtc);
  const eta = REF[String(st.ref) as keyof typeof REF];
  const cop = (eta * (te + 273.15)) / (tc - te);
  return { te, tc, cop, power: s.loadKw / cop, cost: cost(s, st), dTe: s.roomC - te, cop_: (t: number) => (eta * (t + 273.15)) / (tc - t) };
}

const lab: Lab<S> = {
  key: "refrigeration",
  family: "mech",
  format: "simulation",
  name: "Cold-chain plant room",
  topic: "Refrigeration and Air Conditioning · Vapour-compression cycle",
  keywords: ["refrigeration", "air conditioning", "thermodynamics", "heat transfer", "cold storage", "applied thermodynamics"],
  tools: ["Evaporator", "Condenser", "Refrigerant selector", "COP chart"],
  skillTags: ["COP", "Evaporator/condenser temperature", "Refrigerant choice"],
  makeScenario(rng, d) {
    const base: S = { loadKw: rng.pick([5, 8, 12, 20, 35, 50]), roomC: rng.pick([-25, -18, -10, -2, 4]), ambientC: rng.pick([30, 35, 40, 43]), powerMaxKw: 0, budget: 0 };
    const refs = [...gridSettings(lab.controls(base))].filter((st) => analyse(base, st).dTe >= 5);
    const ref = rng.pick(refs);
    const a = analyse(base, ref);
    return { ...base, powerMaxKw: Number((a.power * (d === "easy" ? 1.2 : d === "medium" ? 1.08 : 1.02)).toFixed(2)), budget: Math.ceil((a.cost * (d === "easy" ? 1.2 : d === "medium" ? 1.08 : 1.02)) / 10000) * 10000 };
  },
  given: (s) => [
    { label: "Heat load", value: `${s.loadKw} kW at a ${s.roomC} °C room` },
    { label: "Ambient", value: `${s.ambientC} °C` },
    { label: "Compressor", value: `at most ${s.powerMaxKw} kW input` },
    { label: "Budget", value: rupees(s.budget) },
  ],
  mission: (s) => `Choose evaporator temperature, condenser approach and refrigerant so a ${s.loadKw} kW load holds the room at ${s.roomC} °C with at most ${s.powerMaxKw} kW input, within ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "choice", id: "te", label: "Evaporator temperature", options: choices(TE, (v) => `${v} °C`), default: "-35" },
    { kind: "choice", id: "dtc", label: "Condenser above ambient", options: choices(DTC, (v) => `${v} K`), default: "20" },
    { kind: "choice", id: "ref", label: "Refrigerant", options: choices(Object.keys(REF)), default: "R134a" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("room", "Evaporator at least 5 K colder than the room", a.dTe >= 5, `${fmt(a.dTe, 0)} K below room`, "Heat only flows into the coil if it is colder than the room air. A small gap means a huge, expensive coil."),
      objective("pow", `Compressor power ≤ ${s.powerMaxKw} kW`, a.power <= s.powerMaxKw, `${fmt(a.power, 2)} kW (COP ${fmt(a.cop)})`, "COP rises when the evaporator is warm and the condenser cool; the compressor lifts heat across the temperature gap."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "A tighter temperature approach saves energy but needs bigger heat exchangers."),
    ];
    const pts: [number, number][] = Array.from({ length: 36 }, (_, i) => {
      const t = -40 + i;
      return [t, t < a.tc - 3 ? a.cop_(t) : 0];
    });
    return {
      readings: [info("tc", "Condensing temperature", `${a.tc} °C`), gauge("cop", "COP", a.cop, fmt(a.cop), { min: 0, max: 8 }), gauge("pow", "Compressor power", a.power, `${fmt(a.power, 2)} kW`, { min: 0, max: s.powerMaxKw * 2, high: s.powerMaxKw })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "COP against evaporator temperature", xLabel: "evaporator temperature (°C)", yLabel: "COP", lines: [{ name: "COP", pts, style: "main" }, { name: "Your evaporator", pts: [[a.te, 0], [a.te, Math.max(1, a.cop * 1.3)]], style: "limit" }, { name: "Room", pts: [[s.roomC, 0], [s.roomC, Math.max(1, a.cop * 1.3)]], style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `With the evaporator at ${a.te} °C and the condenser at ${a.tc} °C, the real COP is ${fmt(a.cop)} (a fraction of the Carnot value), so ${s.loadKw} kW of heat removal costs ${fmt(a.power, 2)} kW of compressor power. Raising the evaporator temperature or lowering the condenser temperature shrinks the lift and the power, but both need larger coils and so cost more. Refrigerant choice shifts the efficiency a few percent.`;
  },
  fallback: (s) => ({ title: `Keep the ${s.roomC} °C store cold`, story: `A cold store at ${s.roomC} °C must remove ${s.loadKw} kW of heat in ${s.ambientC} °C summer weather, and its electricity connection can supply the compressor only ${s.powerMaxKw} kW.` }),
};
export default defineLab(lab);
