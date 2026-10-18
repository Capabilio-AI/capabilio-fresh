import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Two-phase signalised junction, Webster's delay formula. Saturation flow 1800 veh/h per lane of green. Lost time 10 s per cycle.
interface S { qA: number; qB: number; delayMax: number; budget: number }

const SAT = 1800;
const LOST = 10;
const LANE_COST = 1_500_000;

function approach(q: number, lanes: number, green: number, cycle: number) {
  const cap = (SAT * lanes * green) / cycle;
  const x = q / cap;
  if (x >= 0.98) return { x, delay: Infinity };
  const lam = green / cycle;
  const d1 = (cycle * (1 - lam) ** 2) / (2 * (1 - lam * x));
  const d2 = (x * x) / (2 * (q / 3600) * (1 - x));
  return { x, delay: 0.9 * (d1 + d2) };
}
function analyse(s: S, st: Settings) {
  const cycle = Number(st.cycle);
  const eff = cycle - LOST;
  const gA = eff * (Number(st.split) / 100);
  const gB = eff - gA;
  const la = Number(st.lanesA);
  const lb = Number(st.lanesB);
  const a = approach(s.qA, la, gA, cycle);
  const b = approach(s.qB, lb, gB, cycle);
  const avg = Number.isFinite(a.delay + b.delay) ? (a.delay * s.qA + b.delay * s.qB) / (s.qA + s.qB) : Infinity;
  return { cycle, gA, gB, a, b, avg, cost: (la - 1 + (lb - 1)) * LANE_COST };
}
const secs = (n: number) => (Number.isFinite(n) ? `${fmt(n, 0)} s` : "queue never clears");

const lab: Lab<S> = {
  key: "signal-timing",
  family: "civil",
  format: "decision",
  name: "Junction control room",
  topic: "Transportation Engineering · Signal timing",
  keywords: ["transportation", "traffic", "highway", "transport"],
  tools: ["Cycle length", "Green split", "Lane allocation", "Delay meter"],
  skillTags: ["Webster delay", "Degree of saturation", "Signal design"],
  makeScenario(rng, d) {
    // the hardest level has no widening budget, so timing alone must work and the demand is chosen to allow it
    if (d === "hard") return { qA: rng.pick([600, 700, 800]), qB: rng.pick([300, 400, 500]), delayMax: 30, budget: 0 };
    return { qA: rng.pick([700, 800, 900, 1000]), qB: rng.pick([400, 500, 600, 700]), delayMax: d === "easy" ? 36 : 29, budget: 1_500_000 };
  },
  given: (s) => [
    { label: "Demand", value: `${s.qA} veh/h on the main road, ${s.qB} veh/h on the side road` },
    { label: "Signal", value: "two phases, 10 s lost time per cycle, 1800 veh/h per lane when green" },
    { label: "Road", value: `one lane each way now; a widening costs ${rupees(LANE_COST)} per lane added` },
  ],
  mission: (s) => `Keep both approaches under 90% saturated with an average delay of at most ${s.delayMax} s per vehicle and widening costs of at most ${rupees(s.budget)}, using a cycle of 40–120 s.`,
  controls: () => [
    { kind: "number", id: "cycle", label: "Cycle length", min: 40, max: 120, step: 10, unit: "s", default: 40 },
    { kind: "number", id: "split", label: "Green share for the main road", min: 30, max: 80, step: 5, unit: "%", default: 50 },
    { kind: "choice", id: "lanesA", label: "Main road lanes", options: choices([1, 2], (v) => `${v} lane${v === "1" ? "" : "s"}`), default: "1" },
    { kind: "choice", id: "lanesB", label: "Side road lanes", options: choices([1, 2], (v) => `${v} lane${v === "1" ? "" : "s"}`), default: "1" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("xa", "Main road under 90% saturated", a.a.x <= 0.9, `${fmt(a.a.x * 100, 0)}%`, "Saturation is demand divided by what the green time can discharge. More green, a longer cycle or another lane all raise capacity."),
      objective("xb", "Side road under 90% saturated", a.b.x <= 0.9, `${fmt(a.b.x * 100, 0)}%`, "Giving the main road more green takes it from the side road. Is there a balance?"),
      objective("delay", `Average delay ≤ ${s.delayMax} s`, a.avg <= s.delayMax, secs(a.avg), "A very long cycle wastes green waiting to turn over, and a very short one loses time to start-ups. Delay is lowest in between."),
      objective("cost", `Widening ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Extra lanes cost real money, so sometimes timing alone has to do the work."),
    ];
    const pts = Array.from({ length: 9 }, (_, i): [number, number] => {
      const c = 40 + i * 10;
      const d = analyse(s, { ...st, cycle: c }).avg;
      return [c, Number.isFinite(d) ? Math.min(d, 120) : 120];
    });
    return {
      readings: [
        gauge("xa", "Main road saturation", Math.min(a.a.x, 1.5), `${fmt(a.a.x * 100, 0)}%`, { min: 0, max: 1.5, high: 0.9 }),
        gauge("xb", "Side road saturation", Math.min(a.b.x, 1.5), `${fmt(a.b.x * 100, 0)}%`, { min: 0, max: 1.5, high: 0.9 }),
        gauge("delay", "Average delay", Number.isFinite(a.avg) ? Math.min(a.avg, 120) : 120, secs(a.avg), { min: 0, max: 120, high: s.delayMax }),
        info("g", "Green times", `${fmt(a.gA, 0)} s main, ${fmt(a.gB, 0)} s side`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Average delay against cycle length",
        xLabel: "cycle length (s)",
        yLabel: "average delay (s, capped at 120)",
        lines: [{ name: "Delay", pts, style: "main" }, { name: "Target", pts: [[40, s.delayMax], [120, s.delayMax]], style: "limit" }, { name: "Your cycle", pts: [[a.cycle, 0], [a.cycle, 120]], style: "ref" }],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `A signal approach can discharge about 1800 vehicles per hour per lane while it is green, so its capacity is that figure times the green share of the cycle. The ratio of demand to capacity is the degree of saturation, ${fmt(a.a.x * 100, 0)}% on the main road and ${fmt(a.b.x * 100, 0)}% on the side road here. Webster's formula shows delay rising sharply as saturation approaches 100%, and also rising when the cycle is long because vehicles wait through a long red. Splitting green roughly in proportion to demand and choosing a cycle near the optimum gave an average delay of ${secs(a.avg)} with ${rupees(a.cost)} of widening.`;
  },
  fallback: (s) => ({
    title: `Retime a ${s.qA + s.qB} veh/h junction`,
    story: "A busy junction near a market backs up every evening. You can change the cycle length, how the green is shared and whether either road gets a second lane.",
  }),
};
export default defineLab(lab);
