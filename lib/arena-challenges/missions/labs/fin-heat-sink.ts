import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Heat Transfer: straight rectangular fins. m = √(2h/(k t)), η_fin = tanh(mL)/(mL), Q = h(A_base + η·A_fin)(Tb − Ta). Base plate 100 × 100 mm, fin 1.5 mm thick.
interface S { watts: number; ambient: number; tBaseMax: number; massMaxG: number }

const COUNT = [4, 6, 8, 10, 12, 14, 16, 18, 20];
const HEIGHT = [10, 15, 20, 25, 30, 40, 50];
const MAT = { aluminium: { k: 205, rho: 2700 }, copper: { k: 385, rho: 8960 } } as const;
const COOL = { "natural air": 12, "small fan": 45, "large fan": 90 } as const;
const T = 0.0015;
const W = 0.1;

function analyse(s: S, st: Settings) {
  const n = Number(st.n);
  const l = Number(st.h) / 1000;
  const m = MAT[String(st.mat) as keyof typeof MAT];
  const h = COOL[String(st.cool) as keyof typeof COOL];
  const mm = Math.sqrt((2 * h) / (m.k * T));
  const eta = Math.tanh(mm * l) / (mm * l);
  const aFin = n * 2 * (l + T / 2) * W;
  const aBase = (W - n * T) * W;
  const q = h * (aBase + eta * aFin);
  const spacing = (W - n * T) / (n - 1 || 1) * 1000;
  return { n, l, eta, rth: 1 / q, tBase: s.ambient + s.watts / q, mass: (0.005 * W * W + n * T * l * W) * m.rho * 1000, spacing, mm, h };
}

const lab: Lab<S> = {
  key: "fin-heat-sink",
  family: "mech",
  format: "simulation",
  name: "Thermal bench",
  topic: "Heat Transfer · Extended surfaces (fins)",
  keywords: ["heat transfer", "thermal", "thermodynamics", "electronics cooling", "fins", "applied thermodynamics"],
  tools: ["Fin count", "Fin height", "Material", "Airflow", "Temperature profile"],
  skillTags: ["Fin efficiency", "Thermal resistance", "Natural vs forced convection"],
  makeScenario(rng, d) {
    const base: S = { watts: rng.pick([20, 40, 60, 100, 150, 200]), ambient: rng.pick([30, 35, 40, 45]), tBaseMax: 0, massMaxG: 0 };
    const ref = rng.pick([...gridSettings(lab.controls(base))].filter((st) => analyse(base, st).spacing >= 3 && Number(st.n) >= 8));
    const a = analyse(base, ref);
    return { ...base, tBaseMax: Math.ceil(a.tBase + (d === "easy" ? 9 : d === "medium" ? 4 : 1)), massMaxG: Math.ceil((a.mass * (d === "easy" ? 1.3 : d === "medium" ? 1.12 : 1.03)) / 10) * 10 };
  },
  given: (s) => [{ label: "Heat to remove", value: `${s.watts} W from a 100 × 100 mm base` }, { label: "Ambient air", value: `${s.ambient} °C` }, { label: "Mass limit", value: `${s.massMaxG} g` }, { label: "Fin gap", value: "at least 3 mm for airflow and dust" }],
  mission: (s) => `Design a finned heat sink that keeps the base under ${s.tBaseMax} °C at ${s.watts} W in ${s.ambient} °C air, under ${s.massMaxG} g, with fins at least 3 mm apart.`,
  controls: () => [
    { kind: "choice", id: "n", label: "Number of fins", options: choices(COUNT), default: "4" },
    { kind: "choice", id: "h", label: "Fin height", options: choices(HEIGHT, (v) => `${v} mm`), default: "10" },
    { kind: "choice", id: "mat", label: "Material", options: choices(Object.keys(MAT)), default: "aluminium" },
    { kind: "choice", id: "cool", label: "Cooling", options: choices(Object.keys(COOL)), default: "natural air" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("temp", `Base ≤ ${s.tBaseMax} °C`, a.tBase <= s.tBaseMax, `${fmt(a.tBase, 1)} °C`, "Base temperature = ambient + power × thermal resistance. More surface and faster air both lower the resistance."),
      objective("mass", `Mass ≤ ${s.massMaxG} g`, a.mass <= s.massMaxG, `${fmt(a.mass, 0)} g`, "Copper conducts better but is more than three times as heavy."),
      objective("gap", "Fin gap ≥ 3 mm", a.spacing >= 3, `${fmt(a.spacing, 1)} mm`, "Crowding fins chokes the airflow between them and clogs with dust."),
    ];
    const pts: [number, number][] = Array.from({ length: 41 }, (_, i) => {
      const x = (i / 40) * a.l;
      return [Number((x * 1000).toFixed(1)), s.ambient + (a.tBase - s.ambient) * (Math.cosh(a.mm * (a.l - x)) / Math.cosh(a.mm * a.l))];
    });
    return {
      readings: [info("eta", "Fin efficiency", `${fmt(a.eta * 100, 0)}%`), info("rth", "Thermal resistance", `${fmt(a.rth, 2)} K/W`), gauge("t", "Base temperature", a.tBase, `${fmt(a.tBase, 1)} °C`, { min: s.ambient, max: s.tBaseMax + 60, high: s.tBaseMax })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Temperature along a fin", xLabel: "distance from base (mm)", yLabel: "fin temperature (°C)", lines: [{ name: "Fin", pts, style: "main" }, { name: "Limit at base", pts: [[0, s.tBaseMax], [a.l * 1000, s.tBaseMax]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The fins are ${fmt(a.eta * 100, 0)}% efficient: the tip is cooler than the root, so the extra length gives diminishing returns. Total thermal resistance is ${fmt(a.rth, 2)} K/W, which at ${s.watts} W lifts the base ${fmt(s.watts * a.rth, 1)} K above the air. Forced air raises the convection coefficient several times over, which is usually cheaper than adding metal.`;
  },
  fallback: (s) => ({ title: `Cool the ${s.watts} W power module`, story: `A solar inverter module dissipates ${s.watts} W in a cabinet at ${s.ambient} °C. The heat sink must keep its base under ${s.tBaseMax} °C without becoming heavy.` }),
};
export default defineLab(lab);
