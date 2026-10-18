import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Air-standard Otto cycle, η = 1 − r^(1−γ) with γ = 1.4. Brake efficiency is taken as 60% of it. 8 kJ of fuel energy per cycle at full throttle.
interface S { rpm: number; powerMin: number; etaMin: number; costMax: number }

const GAMMA = 1.4;
const BRAKE = 0.6;
const Q_FULL = 8; // kJ per cycle
const FUELS: Record<string, { name: string; knock: number; lhv: number; price: number }> = {
  p91: { name: "Petrol, 91 RON", knock: 9, lhv: 44, price: 130 },
  p95: { name: "Petrol, 95 RON", knock: 10.5, lhv: 44, price: 140 },
  p98: { name: "Petrol, 98 RON", knock: 12, lhv: 44, price: 165 },
  cng: { name: "CNG", knock: 13, lhv: 48, price: 75 },
};
const etaAir = (r: number) => 1 - r ** (1 - GAMMA);

function analyse(s: S, st: Settings) {
  const f = FUELS[String(st.fuel)];
  const r = Number(st.r);
  const air = etaAir(r);
  const brake = BRAKE * air;
  const power = brake * Q_FULL * (Number(st.throttle) / 100) * (s.rpm / 120);
  const cost = ((3600 / brake) * f.price) / (f.lhv * 1000);
  return { f, r, air, brake, power, cost, knocks: r > f.knock };
}

const lab: Lab<S> = {
  key: "otto",
  family: "mech",
  format: "lab",
  name: "Engine test cell",
  topic: "Thermodynamics · Otto cycle and engines",
  keywords: ["thermodynamics", "internal combustion", "engine", "applied thermodynamics", "ic engine", "cycle"],
  tools: ["Compression ratio", "Fuel selector", "Throttle", "Dynamometer"],
  skillTags: ["Otto cycle", "Compression ratio", "Engine knock"],
  makeScenario(rng, d) {
    const rpm = rng.pick([2500, 3000, 4000, 5000]);
    const full = BRAKE * etaAir(10) * Q_FULL * (rpm / 120);
    return {
      rpm, powerMin: Math.round(full * rng.pick([0.5, 0.6, 0.7])), etaMin: d === "easy" ? 54 : d === "medium" ? 57 : 60,
      costMax: d === "easy" ? 40 : d === "medium" ? 34 : 30,
    };
  },
  given: (s) => [
    { label: "Engine speed", value: `${s.rpm} rpm, four-stroke` },
    { label: "Model", value: "air-standard Otto cycle (γ = 1.4); brake efficiency 60% of it" },
    { label: "Fuel energy", value: "8 kJ per cycle at full throttle" },
  ],
  mission: (s) => `Tune the engine to give at least ${s.powerMin} kW and an air-standard efficiency of ${s.etaMin}%, without knock and for at most ₹${s.costMax} of fuel per kWh.`,
  controls: () => [
    { kind: "number", id: "r", label: "Compression ratio", min: 6, max: 14, step: 0.5, unit: ":1", default: 8 },
    { kind: "choice", id: "fuel", label: "Fuel", options: Object.entries(FUELS).map(([value, f]) => ({ value, label: f.name })), default: "p91" },
    { kind: "number", id: "throttle", label: "Throttle", min: 40, max: 100, step: 10, unit: "%", default: 40 },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("knock", `No knock (limit ${a.f.knock}:1 for this fuel)`, !a.knocks, a.knocks ? `${fmt(a.r, 1)}:1 knocks` : "runs smoothly", "A higher compression ratio heats the mixture until it ignites on its own. Which fuels resist that?"),
      objective("eta", `Air-standard efficiency ≥ ${s.etaMin}%`, a.air * 100 >= s.etaMin, `${fmt(a.air * 100, 1)}%`, "In the Otto cycle efficiency depends only on the compression ratio."),
      objective("power", `Brake power ≥ ${s.powerMin} kW`, a.power >= s.powerMin, `${fmt(a.power, 1)} kW`, "Power is the work per cycle times the cycles per second. What else scales the fuel burned per cycle?"),
      objective("cost", `Fuel cost ≤ ₹${s.costMax} per kWh`, a.cost <= s.costMax, `₹${fmt(a.cost, 1)} per kWh`, "Cost per kWh depends on both the fuel's price and how efficiently the engine turns it into work."),
    ];
    const curve = Array.from({ length: 17 }, (_, i): [number, number] => [6 + i * 0.5, etaAir(6 + i * 0.5) * 100]);
    return {
      readings: [
        gauge("eta", "Air-standard efficiency", a.air * 100, `${fmt(a.air * 100, 1)}%`, { min: 40, max: 70, low: s.etaMin }),
        gauge("power", "Brake power", a.power, `${fmt(a.power, 1)} kW`, { min: 0, max: Math.max(s.powerMin * 2, a.power * 1.1), low: s.powerMin }),
        gauge("cost", "Fuel cost", a.cost, `₹${fmt(a.cost, 1)}/kWh`, { min: 0, max: Math.max(s.costMax * 2, a.cost * 1.1), high: s.costMax }),
        info("knock", "Knock limit", `${a.f.knock}:1 (${a.f.name})`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Efficiency against compression ratio",
        xLabel: "compression ratio",
        yLabel: "air-standard efficiency (%)",
        lines: [{ name: "Efficiency", pts: curve, style: "main" }, { name: "Knock limit", pts: [[a.f.knock, 50], [a.f.knock, 70]], style: "limit" }, { name: "Your setting", pts: [[a.r, 50], [a.r, 70]], style: "ref" }],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The Otto cycle efficiency is η = 1 − r^(1−γ), which rises with compression ratio: ${fmt(a.air * 100, 1)}% at ${fmt(a.r, 1)}:1. But squeezing the mixture harder heats it, and above the fuel's knock limit it detonates, so the usable ratio is set by the fuel's octane rating. A higher-octane fuel or CNG allows a higher ratio and better efficiency at a higher price per kilogram, while throttle sets how much fuel burns each cycle and so the power. Your engine made ${fmt(a.power, 1)} kW at ₹${fmt(a.cost, 1)} per kWh.`;
  },
  fallback: (s) => ({
    title: `Tune a ${s.rpm} rpm generator engine`,
    story: `A fleet operator wants its generator engines to burn less fuel without pinging under load. The mechanic can change the compression ratio, the fuel grade and how hard the engine works.`,
  }),
};
export default defineLab(lab);
