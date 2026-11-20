import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { analyseFeeder, CAP_OPTIONS_KVAR, type FeederInput } from "../sim/feeder";

// Power Systems: a long feeder sags at its far end because of the reactive current it carries. The student places capacitor banks along it to
// bring every bus into the voltage band and lift the power factor, without overcompensating or exceeding the capacitor budget.
interface S { r: number[]; x: number[]; pKw: number[]; qKvar: number[]; budgetKvar: number }

const V_LOW = 0.95;
const V_HIGH = 1.05;
const PF_TARGET = 0.95;
/** The least total capacitor kvar that brings voltage and power factor in band; null when no plan does. The budget is set just above it. */
function leanest(s: Omit<S, "budgetKvar">): number | null {
  const n = s.pKw.length;
  const idx = new Array<number>(n).fill(0);
  let best: number | null = null;
  for (;;) {
    const capKvar = idx.map((i) => CAP_OPTIONS_KVAR[i]);
    const f = analyseFeeder({ ...s, capKvar });
    const total = capKvar.reduce((a, c) => a + c, 0);
    if (f.voltage.every((v) => v >= V_LOW && v <= V_HIGH) && f.pf >= PF_TARGET && f.qNetKvar >= 0 && (best === null || total < best)) best = total;
    let k = 0;
    while (k < n && ++idx[k] === CAP_OPTIONS_KVAR.length) idx[k++] = 0;
    if (k === n) return best;
  }
}
const inputOf = (s: S, st: Settings): FeederInput => ({ r: s.r, x: s.x, pKw: s.pKw, qKvar: s.qKvar, capKvar: s.pKw.map((_, i) => Number(st[`c${i}`])) });

const lab: Lab<S> = {
  key: "feeder-voltage",
  family: "eee",
  format: "decision",
  surface: "feeder",
  name: "Feeder voltage studio",
  topic: "Power Systems · Voltage regulation and reactive compensation",
  keywords: ["power systems", "power system", "distribution", "transmission", "electrical machines", "power quality", "reactive", "grid"],
  tools: ["Feeder diagram", "Capacitor banks", "Voltage profile", "Power-factor meter"],
  skillTags: ["Voltage drop", "Reactive power", "Power factor correction"],
  makeScenario(rng, d) {
    const n = 4;
    const pKw = Array.from({ length: n }, () => rng.int(5, 11) * 100);
    const pf = rng.pick([0.76, 0.8, 0.84]);
    const base = { pKw, qKvar: pKw.map((p) => Math.round(p * Math.tan(Math.acos(pf)))), r: Array.from({ length: n }, () => rng.int(40, 100) / 10000), x: Array.from({ length: n }, () => rng.int(80, 200) / 10000) };
    const min = leanest(base);
    return { ...base, budgetKvar: min === null ? 0 : min + (d === "easy" ? 400 : d === "medium" ? 200 : 0) };
  },
  given: (s) => [
    { label: "Load at the 4 buses", value: s.pKw.map((p, i) => `${p} kW + ${s.qKvar[i]} kvar`).join("; ") },
    { label: "Voltage band", value: `${V_LOW} to ${V_HIGH} per unit at every bus` },
    { label: "Power factor at the substation", value: `at least ${PF_TARGET} lagging, never leading` },
    { label: "Capacitor budget", value: `${s.budgetKvar} kvar in total` },
  ],
  mission: (s) => `Choose a capacitor bank (0 to ${CAP_OPTIONS_KVAR[CAP_OPTIONS_KVAR.length - 1]} kvar) for each bus so every bus stays between ${V_LOW} and ${V_HIGH} pu, the substation power factor reaches ${PF_TARGET} without going leading, and the banks total at most ${s.budgetKvar} kvar.`,
  controls: (s) => s.pKw.map((_, i) => ({ kind: "choice" as const, id: `c${i}`, label: `Capacitor at bus ${i + 1}`, options: choices(CAP_OPTIONS_KVAR, (v) => (Number(v) === 0 ? "None" : `${v} kvar`)), default: "0" })),
  surfaceData: (s) => ({ r: s.r, x: s.x, pKw: s.pKw, qKvar: s.qKvar, budgetKvar: s.budgetKvar, options: CAP_OPTIONS_KVAR, vLow: V_LOW, vHigh: V_HIGH, pfTarget: PF_TARGET }),
  evaluate(s, st): Outcome {
    const f = analyseFeeder(inputOf(s, st));
    const total = s.pKw.reduce((sum, _, i) => sum + Number(st[`c${i}`]), 0);
    const vMin = Math.min(...f.voltage);
    const vMax = Math.max(...f.voltage);
    const low = f.voltage.flatMap((v, i) => (v < V_LOW ? [i + 1] : []));
    const objectives = [
      objective("low", `Every bus ≥ ${V_LOW} pu`, low.length === 0, low.length ? `bus ${low.join(", ")} too low (${fmt(vMin, 3)} pu)` : `lowest ${fmt(vMin, 3)} pu`, "Voltage drops along the feeder in proportion to the current it carries. Reactive current causes much of the drop, and capacitors supply it locally."),
      objective("high", `No bus above ${V_HIGH} pu`, vMax <= V_HIGH, `highest ${fmt(vMax, 3)} pu`, "Too much capacitance pushes the voltage above the band, especially at the lightly loaded end."),
      objective("pf", `Power factor ≥ ${PF_TARGET} lagging`, f.pf >= PF_TARGET && f.qNetKvar >= 0, f.qNetKvar < 0 ? `leading (${fmt(f.pf, 3)})` : fmt(f.pf, 3), "Power factor improves as capacitors cancel the reactive load. Overshoot makes it leading, which is just as bad."),
      objective("budget", `Capacitors ≤ ${s.budgetKvar} kvar`, total <= s.budgetKvar, `${total} kvar`, "Capacitors near the far end lift the voltage along the whole feeder. Put them where they help most, not everywhere."),
    ];
    return {
      readings: [
        gauge("vmin", "Lowest bus voltage", vMin, `${fmt(vMin, 3)} pu`, { min: 0.85, max: 1.1, low: V_LOW, high: V_HIGH }),
        gauge("pf", "Substation power factor", f.pf, fmt(f.pf, 3), { min: 0.6, max: 1, low: PF_TARGET }),
        info("loss", "Feeder losses", `${fmt(f.lossKw, 0)} kW`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      overlay: { voltage: f.voltage.map((v) => Number(v.toFixed(4))) },
    };
  },
  explain(s, st) {
    const f = analyseFeeder(inputOf(s, st));
    return `With your capacitors the far bus sits at ${fmt(Math.min(...f.voltage), 3)} pu and the substation power factor is ${fmt(f.pf, 3)}, with ${fmt(f.lossKw, 0)} kW lost in the feeder. Compensating reactive power close to where it is drawn means less reactive current flows through the line resistance and reactance, which raises voltage and cuts losses at the same time.`;
  },
  fallback: (s) => ({ title: `Lift the voltage at the end of a ${s.pKw.length}-bus rural feeder`, story: `A long rural feeder leaves the farms at its far end with dim lights and pumps that stall. The engineer has a capacitor budget and must place the banks where they fix voltage and power factor together.` }),
};
export default defineLab(lab);
