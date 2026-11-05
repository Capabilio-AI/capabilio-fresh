import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Water Resources Engineering: reservoir mass balance over 24 months. S(t+1) = min(C, S + I − R), shortage when S + I < R.
interface S { inflow: number[]; demand: number; reliability: number; spillMax: number; budget: number }

const CAP = [5, 10, 15, 20, 30, 40, 60, 80];
const REL = [1, 2, 3, 4, 5, 6, 8, 10];
const COST_PER_MM3 = 2_400_000;

function simulate(s: S, cap: number, release: number) {
  let storage = cap / 2;
  let ok = 0;
  let spill = 0;
  const level: number[] = [];
  for (let t = 0; t < 24; t++) {
    const avail = storage + s.inflow[t % 12];
    const out = Math.min(release, avail);
    if (out >= release - 1e-9) ok++;
    storage = avail - out;
    if (storage > cap) { spill += storage - cap; storage = cap; }
    level.push(storage);
  }
  return { reliability: (ok / 24) * 100, spill, level };
}
function analyse(s: S, st: Settings) {
  const cap = Number(st.cap);
  const release = Number(st.release);
  return { cap, release, ...simulate(s, cap, release), cost: cap * COST_PER_MM3 };
}

const lab: Lab<S> = {
  key: "reservoir",
  family: "civil",
  format: "simulation",
  name: "Reservoir operations room",
  topic: "Water Resources Engineering · Storage and yield",
  keywords: ["water resources", "irrigation", "hydrology", "hydraulic structures", "dam", "reservoir"],
  tools: ["Storage capacity", "Release rate", "Monthly inflow record", "Storage plot"],
  skillTags: ["Mass balance", "Reliability", "Spill and shortage"],
  makeScenario(rng, d) {
    const mean = rng.pick([2, 3, 4, 5, 6]);
    const phase = rng.int(0, 11);
    const inflow = Array.from({ length: 12 }, (_, i) => Math.max(0, Math.round(mean * (1 + 1.6 * Math.sin(((i - phase) / 12) * 2 * Math.PI) + rng.int(-3, 3) / 10) * 10) / 10));
    const base: S = { inflow, demand: 0, reliability: 0, spillMax: 0, budget: 0 };
    const ok = [...gridSettings(lab.controls(base))].filter((st) => { const a = analyse(base, st); return a.reliability >= 90 && Number(st.release) >= 2; });
    if (!ok.length) return { ...base, demand: 1, reliability: 80, spillMax: 200, budget: 200_000_000 };
    const a = analyse(base, rng.pick(ok));
    return { ...base, demand: a.release, reliability: Math.floor(a.reliability - (d === "easy" ? 15 : d === "medium" ? 8 : 0)), spillMax: Math.ceil(a.spill * (d === "easy" ? 1.8 : d === "medium" ? 1.3 : 1.05) + 1), budget: Math.ceil((a.cost * (d === "easy" ? 1.5 : d === "medium" ? 1.2 : 1.03)) / 1_000_000) * 1_000_000 };
  },
  given: (s) => [{ label: "Monthly inflow (Mm³)", value: s.inflow.map((v) => fmt(v, 1)).join(", ") }, { label: "Demand", value: `${s.demand} Mm³ every month` }, { label: "Spill", value: `waste at most ${s.spillMax} Mm³ over two years` }, { label: "Budget", value: rupees(s.budget) }],
  mission: (s) => `Choose a reservoir capacity and monthly release so at least ${s.reliability}% of months meet the demand of ${s.demand} Mm³ with at most ${s.spillMax} Mm³ spilled, within ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "choice", id: "cap", label: "Storage capacity", options: choices(CAP, (v) => `${v} Mm³`), default: "5" },
    { kind: "choice", id: "release", label: "Monthly release", options: choices(REL, (v) => `${v} Mm³`), default: "1" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("rel", `Release meets demand ≥ ${s.reliability}% of months`, a.reliability >= s.reliability, `${fmt(a.reliability, 0)}% of months`, "Dry months drain the store. Bigger storage carries water from wet to dry months."),
      objective("dem", `Release ≥ ${s.demand} Mm³/month`, a.release >= s.demand, `${a.release} Mm³`, "Reliability of a smaller release is easy; the demand fixes the yield you must deliver."),
      objective("spill", `Spill ≤ ${s.spillMax} Mm³`, a.spill <= s.spillMax, `${fmt(a.spill, 1)} Mm³`, "Water that overflows is wasted. Storage that is too small spills in the wet season."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Storage capacity is the most expensive part of a dam."),
    ];
    const pts: [number, number][] = a.level.map((v, i) => [i + 1, v]);
    return {
      readings: [gauge("rel", "Reliability", a.reliability, `${fmt(a.reliability, 0)}%`, { min: 0, max: 100, low: s.reliability }), gauge("sp", "Spill", a.spill, `${fmt(a.spill, 1)} Mm³`, { min: 0, max: Math.max(s.spillMax * 2, a.spill * 1.1), high: s.spillMax }), info("ann", "Mean inflow", `${fmt(s.inflow.reduce((x, y) => x + y, 0) / 12, 1)} Mm³/month`)],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Storage over two years", xLabel: "month", yLabel: "storage (Mm³)", lines: [{ name: "Storage", pts, style: "main" }, { name: "Capacity", pts: [[1, a.cap], [24, a.cap]], style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `Month by month the store gains the inflow and loses the release. With ${a.cap} Mm³ of capacity and ${a.release} Mm³ released each month, the demand is met in ${fmt(a.reliability, 0)}% of months and ${fmt(a.spill, 1)} Mm³ overflows. The mean inflow caps the release you can ever sustain; storage only moves water between seasons. That is why a reservoir is sized from the driest period on record, not the average.`;
  },
  fallback: (s) => ({ title: `Water the district through the dry months`, story: `A small river brings water only in the monsoon, but the district's farms and town need ${s.demand} Mm³ every month of the year. The water-resources office must decide how big a reservoir to build.` }),
};
export default defineLab(lab);
