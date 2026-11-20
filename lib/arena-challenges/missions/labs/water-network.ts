import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { analyseNetwork, COST_PER_M, pipeCost, SIZES_MM, type NetworkInput, type NetworkResult } from "../sim/network";

// Water Supply Engineering: the student sizes every pipe of a branched distribution network. Too small and the far nodes lose pressure and the
// water runs too fast; too large and the budget is gone. The numbers come from Hazen-Williams head loss, not from a lookup.
interface S {
  head: number;
  elev: number[];
  demandLps: number[];
  parent: number[];
  length: number[];
  pMinM: number;
  budget: number;
}

const C_HW = 130;
const V_MIN = 0.6;
const V_MAX = 2.5;
const TOPOLOGIES = [[0, 1, 1, 2, 3], [0, 1, 2, 2, 1], [0, 1, 1, 1, 4]];

const input = (s: S, st: Settings): NetworkInput => ({ head: s.head, elev: s.elev, demandLps: s.demandLps, parent: s.parent, length: s.length, c: C_HW, diameterMm: s.parent.map((_, i) => Number(st[`d${i}`])) });
const analyse = (s: S, st: Settings): { r: NetworkResult; cost: number } => {
  const inp = input(s, st);
  return { r: analyseNetwork(inp), cost: pipeCost(inp) };
};
const fits = (r: NetworkResult, pMin: number) => r.pressureM.every((p) => p >= pMin) && r.velocity.every((v) => v >= V_MIN && v <= V_MAX);

/** The cheapest sizing that meets pressure and velocity: the benchmark a budget is set from. Null when nothing does. */
function cheapest(s: Omit<S, "budget">): number | null {
  const count = s.parent.length;
  const idx = new Array<number>(count).fill(0);
  let best: number | null = null;
  for (;;) {
    const diameterMm = idx.map((i) => SIZES_MM[i]);
    const inp: NetworkInput = { head: s.head, elev: s.elev, demandLps: s.demandLps, parent: s.parent, length: s.length, c: C_HW, diameterMm };
    if (fits(analyseNetwork(inp), s.pMinM)) {
      const cost = pipeCost(inp);
      if (best === null || cost < best) best = cost;
    }
    let k = 0;
    while (k < count && ++idx[k] === SIZES_MM.length) idx[k++] = 0;
    if (k === count) return best;
  }
}

const lab: Lab<S> = {
  key: "water-network",
  family: "civil",
  format: "decision",
  surface: "network",
  name: "Water network designer",
  topic: "Water Supply Engineering · Pipe network design",
  keywords: ["water supply", "environmental engineering", "hydraulics", "fluid mechanics", "irrigation", "public health", "water resources"],
  tools: ["Pipe diameters", "Hydraulic grade line", "Velocity check", "Cost estimate"],
  skillTags: ["Hazen-Williams", "Residual pressure", "Pipe sizing"],
  makeScenario(rng, d) {
    const parent = rng.pick(TOPOLOGIES);
    const base = {
      parent,
      head: 0,
      elev: parent.map(() => rng.int(0, 12)),
      demandLps: parent.map(() => rng.int(4, 18)),
      length: parent.map(() => rng.int(3, 11) * 100),
      pMinM: rng.pick([12, 15, 18]),
    };
    const head = Math.max(...base.elev) + rng.int(34, 52);
    const sized = { ...base, head };
    const min = cheapest(sized);
    const room = d === "easy" ? 1.2 : d === "medium" ? 1.1 : 1.04;
    return { ...sized, budget: min === null ? 0 : Math.ceil((min * room) / 1000) * 1000 };
  },
  given: (s) => [
    { label: "Reservoir level", value: `${s.head} m above datum` },
    { label: "Demand at the 5 nodes", value: s.demandLps.map((q) => `${q}`).join(", ") + " L/s" },
    { label: "Minimum pressure", value: `${s.pMinM} m at every node` },
    { label: "Pipe budget", value: rupees(s.budget) },
  ],
  mission: (s) => `Choose a diameter for each of the five pipes so every node keeps at least ${s.pMinM} m of pressure, water moves between ${V_MIN} and ${V_MAX} m/s in every pipe, and the pipes cost no more than ${rupees(s.budget)}.`,
  controls: (s) => s.parent.map((p, i) => ({ kind: "choice" as const, id: `d${i}`, label: `Pipe ${p === 0 ? "from the reservoir to" : `${p} to`} node ${i + 1} (${s.length[i]} m)`, options: choices(SIZES_MM, (v) => `${v} mm`), default: String(SIZES_MM[0]) })),
  surfaceData: (s) => ({ parent: s.parent, length: s.length, elev: s.elev, demandLps: s.demandLps, head: s.head, pMinM: s.pMinM, budget: s.budget, sizes: SIZES_MM, costPerM: COST_PER_M, vMin: V_MIN, vMax: V_MAX }),
  evaluate(s, st): Outcome {
    const { r, cost } = analyse(s, st);
    const low = r.pressureM.flatMap((p, i) => (p < s.pMinM ? [i + 1] : []));
    const slow = r.velocity.flatMap((v, i) => (v < V_MIN ? [i + 1] : []));
    const fast = r.velocity.flatMap((v, i) => (v > V_MAX ? [i + 1] : []));
    const minP = Math.min(...r.pressureM);
    const objectives = [
      objective("pressure", `Every node keeps ≥ ${s.pMinM} m of pressure`, low.length === 0, low.length === 0 ? `lowest is ${fmt(minP, 1)} m` : `node ${low.join(", ")} too low (${fmt(minP, 1)} m)`, "Pressure is lost along every pipe on the way to a node. The pipes closest to the reservoir carry the most water, so a small pipe there starves everything beyond it."),
      objective("velocity", `Water moves ${V_MIN}–${V_MAX} m/s in every pipe`, slow.length === 0 && fast.length === 0, fast.length ? `pipe to node ${fast.join(", ")} too fast` : slow.length ? `pipe to node ${slow.join(", ")} too slow` : "all pipes in range", "Too fast wears the pipe and wastes pressure. Too slow lets sediment settle. Each pipe has a diameter range that suits its flow."),
      objective("cost", `Pipes cost ≤ ${rupees(s.budget)}`, cost <= s.budget, rupees(cost), "Cost grows quickly with diameter. Put the big pipes only where the flow is big, and use small ones on the dead-end branches."),
    ];
    return {
      readings: [
        gauge("minp", "Lowest pressure", minP, `${fmt(minP, 1)} m`, { min: 0, max: s.pMinM * 2.5, low: s.pMinM }),
        gauge("cost", "Pipe cost", cost, rupees(cost), { min: 0, max: s.budget * 1.8, high: s.budget }),
        info("vel", "Velocity range", `${fmt(Math.min(...r.velocity), 2)}–${fmt(Math.max(...r.velocity), 2)} m/s`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      table: { title: "Pipes", columns: ["Pipe to node", "Flow", "Velocity", "Head loss"], rows: r.flowLps.map((q, i) => [`${i + 1}`, `${fmt(q, 0)} L/s`, `${fmt(r.velocity[i], 2)} m/s`, `${fmt(r.lossM[i], 1)} m`]), bad: r.velocity.flatMap((v, i) => (v > V_MAX || v < V_MIN ? [i] : [])) },
      overlay: { pressure: r.pressureM.map((p) => Number(p.toFixed(2))), velocity: r.velocity.map((v) => Number(v.toFixed(2))), flow: r.flowLps.map((q) => Number(q.toFixed(1))) },
    };
  },
  explain(s, st) {
    const { r, cost } = analyse(s, st);
    const trunk = Math.max(...r.flowLps);
    return `The trunk main carries ${fmt(trunk, 0)} L/s, so it needs the largest pipe; the dead-end branches carry only their own demand and can be small. Your network keeps at least ${fmt(Math.min(...r.pressureM), 1)} m of pressure and costs ${rupees(cost)}. Head loss grows with the 1.852 power of flow and falls with the 4.87 power of diameter, so a small increase in diameter buys a large drop in loss.`;
  },
  fallback: (s) => ({ title: `Plan the water mains for a ${s.parent.length}-point colony`, story: `A growing colony needs a distribution network from the overhead reservoir. The engineer has to size each pipe so the last house still gets water at pressure, within the municipal budget.` }),
};
export default defineLab(lab);
