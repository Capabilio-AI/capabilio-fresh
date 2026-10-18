import { fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Oil cooler, effectiveness-NTU method. Cmin is the oil side. U rises with coolant flow as (flow)^0.8. Pump power ∝ flow³.
interface S { mHot: number; tHotIn: number; tColdIn: number; tHotMax: number; tColdMax: number; pumpMaxKw: number; budget: number }

const CP_HOT = 2.0; // kJ/kg·K oil
const CP_COLD = 4.18; // water
const U_BASE = 0.35; // kW/m²·K at 1 kg/s
const AREA_PRICE = 9_000; // ₹ per m²

function effectiveness(ntu: number, cr: number, counter: boolean): number {
  if (counter) return cr >= 0.999 ? ntu / (1 + ntu) : (1 - Math.exp(-ntu * (1 - cr))) / (1 - cr * Math.exp(-ntu * (1 - cr)));
  return (1 - Math.exp(-ntu * (1 + cr))) / (1 + cr);
}
function analyse(s: S, st: Settings) {
  const flow = Number(st.flow);
  const area = Number(st.area);
  const counter = String(st.arr) === "counter";
  const ch = s.mHot * CP_HOT;
  const cc = flow * CP_COLD;
  const cmin = Math.min(ch, cc);
  const cr = cmin / Math.max(ch, cc);
  const ntu = (U_BASE * flow ** 0.8 * area) / cmin;
  const eps = effectiveness(ntu, cr, counter);
  const q = eps * cmin * (s.tHotIn - s.tColdIn);
  return { flow, area, eps, q, tHotOut: s.tHotIn - q / ch, tColdOut: s.tColdIn + q / cc, pump: 0.12 * flow ** 3, cost: area * AREA_PRICE };
}

const lab: Lab<S> = {
  key: "heat-exchanger",
  family: "mech",
  format: "lab",
  name: "Heat exchanger bench",
  topic: "Heat Transfer · Heat exchangers",
  keywords: ["heat transfer", "heat exchanger", "thermal engineering", "thermal", "refrigeration", "heat and mass"],
  tools: ["Coolant flow valve", "Exchanger area", "Flow arrangement", "Thermometers"],
  skillTags: ["Effectiveness–NTU", "Counterflow", "Pumping power"],
  makeScenario(rng, d) {
    const tHotIn = rng.pick([85, 90, 95]);
    return {
      mHot: rng.pick([0.8, 1, 1.2]), tHotIn, tColdIn: rng.pick([25, 28, 30]), tHotMax: tHotIn - (d === "easy" ? 30 : d === "medium" ? 34 : 36),
      tColdMax: d === "easy" ? 70 : d === "medium" ? 60 : 55, pumpMaxKw: d === "easy" ? 0.6 : d === "medium" ? 0.4 : 0.3, budget: d === "easy" ? 80_000 : d === "medium" ? 64_000 : 58_000,
    };
  },
  given: (s) => [
    { label: "Oil", value: `${s.mHot} kg/s at ${s.tHotIn} °C, cp = 2.0 kJ/kg·K` },
    { label: "Cooling water", value: `from ${s.tColdIn} °C, cp = 4.18 kJ/kg·K` },
    { label: "Prices", value: `${rupees(AREA_PRICE)} per m² of exchanger; pump power grows with the cube of the flow` },
  ],
  mission: (s) => `Cool the oil to at most ${s.tHotMax} °C, keep the returning water under ${s.tColdMax} °C, use no more than ${s.pumpMaxKw} kW of pumping power and stay within ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "number", id: "flow", label: "Coolant flow", min: 0.5, max: 3, step: 0.25, unit: "kg/s", default: 0.5 },
    { kind: "number", id: "area", label: "Exchanger area", min: 2, max: 10, step: 1, unit: "m²", default: 2 },
    { kind: "choice", id: "arr", label: "Flow arrangement", options: [{ value: "parallel", label: "Parallel flow" }, { value: "counter", label: "Counterflow" }], default: "parallel" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("oil", `Oil outlet ≤ ${s.tHotMax} °C`, a.tHotOut <= s.tHotMax, `${fmt(a.tHotOut, 1)} °C`, "More area, a better arrangement and more coolant all raise the heat removed. Which of them have you not tried?"),
      objective("water", `Water outlet ≤ ${s.tColdMax} °C`, a.tColdOut <= s.tColdMax, `${fmt(a.tColdOut, 1)} °C`, "The same heat spread over more water gives a smaller temperature rise."),
      objective("pump", `Pumping power ≤ ${s.pumpMaxKw} kW`, a.pump <= s.pumpMaxKw, `${fmt(a.pump, 2)} kW`, "Pumping power grows with the cube of the flow, so very high flow is expensive to run."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Area is what you buy; the pump you run. Which is cheaper to add?"),
    ];
    const pts = Array.from({ length: 11 }, (_, i): [number, number] => {
      const flow = 0.5 + i * 0.25;
      return [flow, analyse(s, { ...st, flow }).tHotOut];
    });
    return {
      readings: [
        gauge("oil", "Oil outlet", a.tHotOut, `${fmt(a.tHotOut, 1)} °C`, { min: s.tColdIn, max: s.tHotIn, high: s.tHotMax }),
        gauge("water", "Water outlet", a.tColdOut, `${fmt(a.tColdOut, 1)} °C`, { min: s.tColdIn, max: s.tColdMax * 1.4, high: s.tColdMax }),
        gauge("pump", "Pumping power", a.pump, `${fmt(a.pump, 2)} kW`, { min: 0, max: s.pumpMaxKw * 3, high: s.pumpMaxKw }),
        info("eps", "Effectiveness", `${fmt(a.eps * 100, 0)}%  ·  ${fmt(a.q, 0)} kW of heat`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Oil outlet against coolant flow",
        xLabel: "coolant flow (kg/s)",
        yLabel: "oil outlet (°C)",
        lines: [{ name: "Oil outlet", pts, style: "main" }, { name: "Target", pts: [[0.5, s.tHotMax], [3, s.tHotMax]], style: "limit" }, { name: "Your flow", pts: [[a.flow, s.tColdIn], [a.flow, s.tHotIn]], style: "ref" }],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `In a heat exchanger the heat moved is Q = ε·Cmin·(Th,in − Tc,in), where effectiveness ε depends on the number of transfer units NTU = UA/Cmin and on the arrangement. Counterflow keeps a temperature difference along the whole length, so it reaches a higher ε than parallel flow for the same area. Here ε = ${fmt(a.eps * 100, 0)}% moves ${fmt(a.q, 0)} kW and cools the oil to ${fmt(a.tHotOut, 1)} °C. More coolant raises U and spreads the heat, but pumping power rises with the cube of the flow (${fmt(a.pump, 2)} kW), while more area costs money once: that trade-off is what you tuned.`;
  },
  fallback: (s) => ({
    title: `Cool ${s.mHot} kg/s of hot gearbox oil`,
    story: "A wind-turbine gearbox overheats in summer. You can change the coolant flow, the exchanger area and whether the fluids run the same way or against each other.",
  }),
};
export default defineLab(lab);
