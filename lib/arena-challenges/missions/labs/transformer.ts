import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// DC Machines and Transformers: efficiency η = x·S·pf / (x·S·pf + Pcore + x²·Pcu); regulation ≈ x(R·cosφ + X·sinφ); short-circuit current = 100/Z × rated.
interface S { kva: number; load: number; pf: number; etaMin: number; regMax: number; iscMax: number; budget: number }

const CORE = [0.15, 0.2, 0.3, 0.4, 0.5, 0.7, 1]; // % of kVA, iron loss
const CU = [0.6, 0.8, 1, 1.3, 1.6, 2, 2.5]; // % of kVA at full load
const Z = [3, 4, 5, 6, 7, 8];
const price = (s: S, st: Settings) => s.kva * (850 + 95 / Number(st.core) + 120 / Number(st.cu) + 15 * (8 - Number(st.z)) ** 0.5 * 10);

function analyse(s: S, st: Settings) {
  const core = (Number(st.core) / 100) * s.kva * 1000;
  const cu = (Number(st.cu) / 100) * s.kva * 1000;
  const z = Number(st.z);
  const r = Number(st.cu);
  const x = z > r ? Math.sqrt(z * z - r * r) : 0;
  const eta = (l: number) => (l * s.kva * 1000 * s.pf) / (l * s.kva * 1000 * s.pf + core + l * l * cu);
  const sin = Math.sqrt(1 - s.pf * s.pf);
  return { eta, etaAt: eta(s.load), reg: r * s.pf + x * sin, isc: 100 / z, cost: price(s, st), xMax: Math.sqrt(core / cu), valid: z > r };
}

const lab: Lab<S> = {
  key: "transformer",
  family: "eee",
  format: "simulation",
  name: "Transformer test bench",
  topic: "DC Machines and Transformers · Losses, efficiency and regulation",
  keywords: ["transformers", "dc machines", "electrical machines", "power systems", "distribution"],
  tools: ["Loss class selector", "Impedance selector", "Load bank", "Efficiency curve"],
  skillTags: ["Transformer efficiency", "Voltage regulation", "Short-circuit current"],
  makeScenario(rng, d) {
    const base: S = { kva: rng.pick([25, 63, 100, 160, 250, 400, 630]), load: rng.int(3, 8) / 10, pf: rng.pick([0.8, 0.85, 0.9, 0.95]), etaMin: 0, regMax: 0, iscMax: 0, budget: Infinity };
    const ref = rng.pick([...gridSettings(lab.controls(base))].filter((st) => analyse(base, st).valid));
    const a = analyse(base, ref);
    const k = d === "easy" ? 0.996 : d === "medium" ? 0.999 : 1;
    return { ...base, etaMin: Number((a.etaAt * k * 100).toFixed(2)), regMax: Number((a.reg * (d === "easy" ? 1.15 : d === "medium" ? 1.07 : 1.02)).toFixed(2)), iscMax: Number((a.isc * (d === "easy" ? 1.15 : d === "medium" ? 1.07 : 1.02)).toFixed(1)), budget: Math.ceil((a.cost * (d === "easy" ? 1.12 : d === "medium" ? 1.05 : 1.01)) / 1000) * 1000 };
  },
  given: (s) => [
    { label: "Rating", value: `${s.kva} kVA distribution transformer` },
    { label: "Typical load", value: `${Math.round(s.load * 100)}% at power factor ${s.pf}` },
    { label: "Short-circuit limit", value: `at most ${s.iscMax}× rated current` },
    { label: "Budget", value: rupees(s.budget) },
  ],
  mission: (s) => `Choose core loss, copper loss and impedance for ${s.etaMin}% efficiency at ${Math.round(s.load * 100)}% load, regulation under ${s.regMax}% and short-circuit current under ${s.iscMax}× rated, within ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "choice", id: "core", label: "Core (iron) loss", options: choices(CORE, (v) => `${v}% of kVA`), default: "1" },
    { kind: "choice", id: "cu", label: "Copper loss at full load", options: choices(CU, (v) => `${v}% of kVA`), default: "2.5" },
    { kind: "choice", id: "z", label: "Impedance", options: choices(Z, (v) => `${v}%`), default: "3" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("eta", `Efficiency at ${Math.round(s.load * 100)}% load ≥ ${s.etaMin}%`, a.etaAt * 100 >= s.etaMin, `${fmt(a.etaAt * 100, 2)}%`, "Efficiency peaks where copper loss equals core loss. Where is your peak relative to the typical load?"),
      objective("reg", `Regulation ≤ ${s.regMax}%`, a.valid && a.reg <= s.regMax, a.valid ? `${fmt(a.reg)}%` : "impedance below copper loss: impossible", "Voltage drop comes from resistance and leakage reactance. Impedance must exceed the resistive part."),
      objective("isc", `Short-circuit current ≤ ${s.iscMax}× rated`, a.isc <= s.iscMax, `${fmt(a.isc, 1)}× rated`, "A low impedance lets a fault current rise higher. Check the breaker rating."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Lower losses mean more or better steel and copper."),
    ];
    const pts: [number, number][] = Array.from({ length: 56 }, (_, i) => [Number((0.05 + i * 0.02).toFixed(2)), a.eta(0.05 + i * 0.02) * 100]);
    return {
      readings: [info("peak", "Peak efficiency at", `${fmt(a.xMax * 100, 0)}% load`), gauge("eta", "Efficiency at typical load", a.etaAt * 100, `${fmt(a.etaAt * 100, 2)}%`, { min: 90, max: 100, low: s.etaMin }), gauge("reg", "Regulation", a.reg, `${fmt(a.reg)}%`, { min: 0, max: s.regMax * 2, high: s.regMax })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Efficiency against load", xLabel: "load (per unit)", yLabel: "efficiency (%)", lines: [{ name: "η", pts, style: "main" }, { name: "Typical load", pts: [[s.load, 90], [s.load, 100]], style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `Efficiency is highest when copper loss equals core loss, at ${fmt(a.xMax * 100, 0)}% load for this choice. A transformer that mostly runs at ${Math.round(s.load * 100)}% load should peak near there, which is why distribution transformers are built with low core loss. Impedance trades regulation (${fmt(a.reg)}%) against fault current (${fmt(a.isc, 1)}× rated), and every loss reduction costs money.`;
  },
  fallback: (s) => ({ title: `Pick the ${s.kva} kVA village transformer`, story: `A village feeder will load a new ${s.kva} kVA transformer to about ${Math.round(s.load * 100)}% most of the day, so energy lost in the core and windings is paid for every hour. The utility has ${rupees(s.budget)} to spend.` }),
};
export default defineLab(lab);
