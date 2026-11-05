import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Electric Vehicles: road-load energy per km (rolling + aerodynamic), battery mass, motor power. Wh/km = (Crr·m·g + ½ρ·CdA·v²)·1000/3600/η.
interface S { rangeKm: number; cruiseKmh: number; gradePct: number; topKmh: number; budget: number }

const BATT = [20, 30, 40, 50, 60, 75, 90];
const MOTOR = [30, 45, 60, 80, 100, 130];
const TYRE = [0.007, 0.009, 0.011];
const BODY = 1000; // kg without battery
const CDA = 0.7;
const ETA = 0.88;

function analyse(s: S, st: Settings) {
  const kwh = Number(st.kwh);
  const kw = Number(st.kw);
  const crr = Number(st.crr);
  const mass = BODY + kwh * 7 + kw * 2;
  const road = (vKmh: number, grade = 0) => {
    const v = vKmh / 3.6;
    const f = crr * mass * 9.81 + 0.5 * 1.2 * CDA * v * v + mass * 9.81 * Math.sin(Math.atan(grade / 100));
    return f;
  };
  const whKm = (road(s.cruiseKmh) * 1000) / 3600 / ETA;
  let top = 0;
  for (let v = 20; v <= 200; v += 2) if ((road(v) * (v / 3.6)) / 1000 / ETA <= kw) top = v;
  const climbKw = (road(40, s.gradePct) * (40 / 3.6)) / 1000 / ETA;
  return { mass, whKm, range: (kwh * 0.9 * 1000) / whKm, top, climbKw, kw, cost: kwh * 9500 + kw * 2200 + (crr < 0.009 ? 12000 : 0), road, kwh };
}

const lab: Lab<S> = {
  key: "ev-range",
  family: "eee",
  format: "simulation",
  name: "EV design studio",
  topic: "Electric Vehicles · Range, motor sizing and energy use",
  keywords: ["electric vehicles", "electric drives", "energy storage", "battery", "power electronics", "mechatronics"],
  tools: ["Battery pack", "Traction motor", "Tyre selector", "Energy-per-km plot"],
  skillTags: ["Road load", "Battery sizing", "Motor power"],
  makeScenario(rng, d) {
    const base: S = { rangeKm: 0, cruiseKmh: rng.pick([40, 50, 60, 70, 80]), gradePct: rng.pick([4, 6, 8, 10, 12]), topKmh: 0, budget: Infinity };
    const ref = rng.pick([...gridSettings(lab.controls(base))].filter((st) => Number(st.kwh) >= 30));
    const a = analyse(base, ref);
    const k = d === "easy" ? 0.88 : d === "medium" ? 0.94 : 0.98;
    return { ...base, rangeKm: Math.floor((a.range * k) / 5) * 5, topKmh: Math.max(60, Math.floor((a.top * k) / 5) * 5), budget: Math.ceil((a.cost * (d === "easy" ? 1.12 : d === "medium" ? 1.05 : 1.02)) / 10000) * 10000 };
  },
  given: (s) => [
    { label: "Duty", value: `${s.cruiseKmh} km/h city cruise, ${s.gradePct}% hill at 40 km/h` },
    { label: "Range needed", value: `${s.rangeKm} km on 90% of the battery` },
    { label: "Top speed", value: `${s.topKmh} km/h` },
    { label: "Budget", value: `${rupees(s.budget)} for battery, motor and tyres` },
  ],
  mission: (s) => `Size the battery, motor and tyres for ${s.rangeKm} km range at ${s.cruiseKmh} km/h, a ${s.topKmh} km/h top speed and a ${s.gradePct}% hill climb, within ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "choice", id: "kwh", label: "Battery capacity", options: choices(BATT, (v) => `${v} kWh`), default: "20" },
    { kind: "choice", id: "kw", label: "Motor power", options: choices(MOTOR, (v) => `${v} kW`), default: "30" },
    { kind: "choice", id: "crr", label: "Tyres (rolling resistance)", options: choices(TYRE, (v) => (Number(v) < 0.009 ? "low-rolling-resistance" : Number(v) < 0.011 ? "standard" : "budget")), default: "0.011" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("range", `Range ≥ ${s.rangeKm} km`, a.range >= s.rangeKm, `${fmt(a.range, 0)} km (${fmt(a.whKm, 0)} Wh/km)`, "Range is usable battery energy divided by energy per km. A bigger battery adds mass, which raises the energy per km."),
      objective("top", `Top speed ≥ ${s.topKmh} km/h`, a.top >= s.topKmh, `${a.top} km/h`, "At speed, air drag grows with the square of speed and power with its cube."),
      objective("hill", `Climb ${s.gradePct}% hill at 40 km/h`, a.climbKw <= a.kw, `needs ${fmt(a.climbKw, 0)} kW of ${a.kw} kW`, "Gradient force is mass × g × slope; it dominates at low speed."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Battery is the most expensive part of an EV."),
    ];
    const pts: [number, number][] = Array.from({ length: 36 }, (_, i) => [20 + i * 4, (a.road(20 + i * 4) * 1000) / 3600 / ETA]);
    return {
      readings: [info("mass", "Vehicle mass", `${fmt(a.mass, 0)} kg`), gauge("range", "Range", a.range, `${fmt(a.range, 0)} km`, { min: 0, max: s.rangeKm * 2, low: s.rangeKm }), gauge("top", "Top speed", a.top, `${a.top} km/h`, { min: 0, max: 200, low: s.topKmh })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Energy use against speed", xLabel: "speed (km/h)", yLabel: "Wh per km", lines: [{ name: "Road load", pts, style: "main" }, { name: "Cruise speed", pts: [[s.cruiseKmh, 0], [s.cruiseKmh, pts[pts.length - 1][1]]], style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The ${fmt(a.mass, 0)} kg vehicle needs ${fmt(a.whKm, 0)} Wh/km at ${s.cruiseKmh} km/h, so ${fmt(a.kwh * 0.9, 0)} kWh of usable energy gives ${fmt(a.range, 0)} km. Doubling the speed roughly quadruples the drag force. Every extra kWh adds about 7 kg, so battery capacity gives diminishing returns. The motor must cover both the top-speed power and the hill-climb power, whichever is larger.`;
  },
  fallback: (s) => ({ title: `Design a ${s.rangeKm} km city EV`, story: `A start-up is building a small electric vehicle for hill-town delivery runs. It must manage ${s.rangeKm} km between charges and still climb ${s.gradePct}% slopes with a load, and the costs must stay within ${rupees(s.budget)}.` }),
};
export default defineLab(lab);
