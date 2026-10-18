import { fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Closed levelling loop of K km with equal fore and back sights (curvature and refraction cancel). Reading error per setup grows with sight length;
// averaging m readings divides it by √m. Expected misclosure at 95% confidence is 2·σ_setup·√n, where n = loop length / (2 × sight).
interface S { k: number; tolMm: number; hoursMax: number; visibility: number; budget: number }

const INSTRUMENTS: Record<string, { name: string; sigma: number; maxRange: number; dayRate: number }> = {
  dumpy: { name: "Dumpy level", sigma: 1.6, maxRange: 60, dayRate: 800 },
  auto: { name: "Automatic level", sigma: 1, maxRange: 80, dayRate: 1500 },
  digital: { name: "Digital level", sigma: 0.45, maxRange: 100, dayRate: 3500 },
};
const HOURS_PER_DAY = 6;

function analyse(s: S, st: Settings) {
  const inst = INSTRUMENTS[String(st.inst)];
  const sight = Number(st.sight);
  const m = Number(st.reads);
  const n = Math.max(1, Math.round((s.k * 1000) / (2 * sight)));
  const sigmaSetup = (inst.sigma * (sight / 30)) / Math.sqrt(m);
  const misclosure = 2 * sigmaSetup * Math.sqrt(n);
  const hours = (n * (3 + 1.5 * m)) / 60;
  const cost = Math.ceil(hours / HOURS_PER_DAY) * inst.dayRate;
  return { inst, sight, m, n, misclosure, hours, cost };
}

const lab: Lab<S> = {
  key: "levelling",
  family: "civil",
  format: "lab",
  name: "Levelling survey desk",
  topic: "Surveying · Levelling and errors",
  keywords: ["surveying", "levelling", "geomatics", "survey"],
  tools: ["Level selector", "Sight length", "Readings per sight", "Loop misclosure"],
  skillTags: ["Differential levelling", "Misclosure", "Error accumulation"],
  makeScenario(rng, d) {
    const k = rng.pick([1, 1.5, 2, 3]);
    return {
      k, tolMm: Math.round(k ** 0.5 * (d === "easy" ? 9 : d === "medium" ? 8 : 7)), hoursMax: d === "easy" ? 10 : d === "medium" ? 8 : 7,
      visibility: rng.pick([50, 60, 80]), budget: d === "easy" ? 3600 : d === "medium" ? 3000 : 2400,
    };
  },
  given: (s) => [
    { label: "Loop", value: `${s.k} km closed levelling loop, equal fore and back sights` },
    { label: "Site", value: `trees and traffic limit a clear sight to ${s.visibility} m` },
    { label: "Rates", value: `${rupees(800)}, ${rupees(1500)} or ${rupees(3500)} a day for a dumpy, automatic or digital level; one day is ${HOURS_PER_DAY} field hours` },
  ],
  mission: (s) => `Plan the survey so the expected loop misclosure (95% confidence) is within ±${s.tolMm} mm, the sights fit the site and instrument range, the fieldwork takes at most ${s.hoursMax} hours and the hire costs at most ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "choice", id: "inst", label: "Instrument", options: Object.entries(INSTRUMENTS).map(([value, i]) => ({ value, label: i.name })), default: "dumpy" },
    { kind: "number", id: "sight", label: "Sight length", min: 20, max: 100, step: 10, unit: "m", default: 60 },
    { kind: "number", id: "reads", label: "Readings averaged per sight", min: 1, max: 3, step: 1, unit: "", default: 1 },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const reach = Math.min(a.inst.maxRange, s.visibility);
    const objectives = [
      objective("err", `Misclosure within ±${s.tolMm} mm`, a.misclosure <= s.tolMm, `±${fmt(a.misclosure, 1)} mm`, "Each setup adds a small error, and the errors add up in proportion to the square root of the setups. What reduces the error per setup?"),
      objective("reach", `Sights ≤ ${reach} m (site visibility and instrument range)`, a.sight <= reach, `${a.sight} m`, "A shorter sight reads more accurately but needs more setups. A long sight may not be readable on this site."),
      objective("time", `Fieldwork ≤ ${s.hoursMax} hours`, a.hours <= s.hoursMax, `${fmt(a.hours, 1)} hours over ${a.n} setups`, "Short sights and repeated readings both cost time. Is there a more accurate instrument that lets you relax one of them?"),
      objective("cost", `Hire ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "A better instrument costs more per day but can save days."),
    ];
    const pts = Array.from({ length: 9 }, (_, i): [number, number] => [20 + i * 10, analyse(s, { ...st, sight: 20 + i * 10 }).misclosure]);
    return {
      readings: [
        gauge("err", "Expected misclosure (95%)", a.misclosure, `±${fmt(a.misclosure, 1)} mm`, { min: 0, max: s.tolMm * 2.5, high: s.tolMm }),
        gauge("time", "Fieldwork time", a.hours, `${fmt(a.hours, 1)} h`, { min: 0, max: s.hoursMax * 2, high: s.hoursMax }),
        gauge("cost", "Hire cost", a.cost, rupees(a.cost), { min: 0, max: s.budget * 1.8, high: s.budget }),
        info("n", "Instrument setups", `${a.n}`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Expected misclosure against sight length",
        xLabel: "sight length (m)",
        yLabel: "misclosure (mm)",
        lines: [{ name: "Misclosure", pts, style: "main" }, { name: "Tolerance", pts: [[20, s.tolMm], [100, s.tolMm]], style: "limit" }, { name: "Your sight", pts: [[a.sight, 0], [a.sight, Math.max(...pts.map((p) => p[1]))]], style: "ref" }],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `Random reading errors in levelling accumulate as the square root of the number of setups. With ${a.sight} m sights the ${s.k} km loop needs ${a.n} setups, each with an error that grows with sight length and shrinks when readings are averaged, giving an expected misclosure of ±${fmt(a.misclosure, 1)} mm at 95% confidence against the ±${s.tolMm} mm allowed. Keeping fore and back sights equal cancels curvature and refraction, so the remaining choice is between a better instrument, shorter sights and repeat readings, each trading time and money against accuracy. The ${a.n} setups take ${fmt(a.hours, 1)} hours and cost ${rupees(a.cost)}.`;
  },
  fallback: (s) => ({
    title: `Level a ${s.k} km site loop`,
    story: "A contractor must establish benchmarks around a new building site. You choose the level, how long each sight is and how many readings to average.",
  }),
};
export default defineLab(lab);
