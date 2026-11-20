import { fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { analyseChain, snrDb, STAGES } from "../sim/chain";

// Communication Systems: choose a part for each stage of a receiver so the signal arrives clean, strong enough for the ADC but not clipping it,
// the interferer is filtered out, and the power and cost budgets hold. Cascaded noise figure follows the Friis formula.
interface S {
  inputDbm: number;
  bandwidthKhz: number;
  snrTarget: number;
  adcLow: number;
  adcHigh: number;
  rejectionNeed: number;
  powerMw: number;
  costBudget: number;
}

const choiceOf = (st: Settings) => STAGES.map((s) => Number(st[s.id]));
const COMBOS = STAGES[0].parts.flatMap((_, a) => STAGES[1].parts.flatMap((_, b) => STAGES[2].parts.flatMap((_, c) => STAGES[3].parts.map((_, d) => [a, b, c, d]))));

/** Every chain that clears the level window and the interferer, with its SNR: what a scenario's targets are set from. */
function feasible(s: Pick<S, "inputDbm" | "bandwidthKhz" | "adcLow" | "adcHigh" | "rejectionNeed">) {
  return COMBOS.flatMap((c) => {
    const r = analyseChain(c, s.inputDbm, s.bandwidthKhz);
    const level = s.inputDbm + r.totalGainDb;
    return level >= s.adcLow && level <= s.adcHigh && r.rejectionDb >= s.rejectionNeed ? [{ r, snr: snrDb(s.inputDbm, s.bandwidthKhz, r.nfDb, r.totalGainDb) }] : [];
  });
}

const lab: Lab<S> = {
  key: "rf-chain",
  family: "ece",
  format: "decision",
  surface: "chain",
  name: "Receiver chain designer",
  topic: "Communication Systems · Receiver noise figure and link budget",
  keywords: ["communication", "rf", "microwave", "antenna", "wireless", "analog communication", "digital communication", "receiver", "telecommunication"],
  tools: ["Part catalogue", "Level diagram", "Noise-figure calculator", "Budget sheet"],
  skillTags: ["Friis noise figure", "Link budget", "Filter selection"],
  makeScenario(rng, d) {
    const adcHigh = rng.pick([-10, -8, -5]);
    const base = { inputDbm: rng.int(-78, -64), bandwidthKhz: rng.pick([10, 25, 50, 100, 200]), adcLow: adcHigh - 12, adcHigh, rejectionNeed: rng.pick([18, 25, 40]) };
    const ok = feasible(base);
    if (ok.length === 0) return { ...base, snrTarget: 99, powerMw: 0, costBudget: 0 };
    // targets come from the best a real chain can do, so the mission is always winnable and never trivial
    const slack = d === "easy" ? 6 : d === "medium" ? 3 : 1.5;
    const snrTarget = Math.floor((Math.max(...ok.map((x) => x.snr)) - slack) * 2) / 2;
    const meets = ok.filter((x) => x.snr >= snrTarget);
    const room = d === "easy" ? 1.3 : d === "medium" ? 1.15 : 1.05;
    const pick = meets.reduce((best, x) => (x.r.cost / 1000 + x.r.powerMw / 300 < best.r.cost / 1000 + best.r.powerMw / 300 ? x : best));
    return { ...base, snrTarget, powerMw: Math.ceil((pick.r.powerMw * room) / 10) * 10, costBudget: Math.ceil((pick.r.cost * room) / 50) * 50 };
  },
  given: (s) => [
    { label: "Signal at the antenna", value: `${s.inputDbm} dBm in ${s.bandwidthKhz} kHz` },
    { label: "Needed at the output", value: `SNR ≥ ${s.snrTarget} dB; ADC level ${s.adcLow} to ${s.adcHigh} dBm` },
    { label: "Interferer", value: `needs ≥ ${s.rejectionNeed} dB of filtering` },
    { label: "Budgets", value: `${s.powerMw} mW and ${rupees(s.costBudget)}` },
  ],
  mission: (s) => `Pick one part for each of the four stages so the receiver reaches SNR ≥ ${s.snrTarget} dB, delivers ${s.adcLow} to ${s.adcHigh} dBm to the ADC, rejects the interferer by ${s.rejectionNeed} dB, and stays within ${s.powerMw} mW and ${rupees(s.costBudget)}.`,
  controls: () => STAGES.map((s) => ({ kind: "choice" as const, id: s.id, label: s.label, options: s.parts.map((p, i) => ({ value: String(i), label: p.name })), default: "0" })),
  surfaceData: (s) => ({ stages: STAGES, inputDbm: s.inputDbm, bandwidthKhz: s.bandwidthKhz, snrTarget: s.snrTarget, adcLow: s.adcLow, adcHigh: s.adcHigh, rejectionNeed: s.rejectionNeed, powerMw: s.powerMw, costBudget: s.costBudget }),
  evaluate(s, st): Outcome {
    const r = analyseChain(choiceOf(st), s.inputDbm, s.bandwidthKhz);
    const snr = snrDb(s.inputDbm, s.bandwidthKhz, r.nfDb, r.totalGainDb);
    const level = s.inputDbm + r.totalGainDb;
    const objectives = [
      objective("snr", `Output SNR ≥ ${s.snrTarget} dB`, snr >= s.snrTarget, `${fmt(snr, 1)} dB (noise figure ${fmt(r.nfDb, 1)} dB)`, "The first stage sets the noise figure for the whole chain, because its gain divides down the noise of every stage after it. A quiet first amplifier matters most."),
      objective("level", `Signal at the ADC between ${s.adcLow} and ${s.adcHigh} dBm`, level >= s.adcLow && level <= s.adcHigh, `${fmt(level, 1)} dBm (gain ${fmt(r.totalGainDb, 1)} dB)`, "Too little gain wastes the ADC's resolution, too much clips it. Add up the gains and losses of all four stages."),
      objective("reject", `Interferer rejected by ≥ ${s.rejectionNeed} dB`, r.rejectionDb >= s.rejectionNeed, `${fmt(r.rejectionDb, 0)} dB`, "Only the filter stage rejects the interferer. A filter costs signal and adds noise, so choose the lightest one that is good enough."),
      objective("power", `Power ≤ ${s.powerMw} mW`, r.powerMw <= s.powerMw, `${fmt(r.powerMw, 0)} mW`, "Each active part draws current from the 5 V supply. Gain stages are the biggest consumers."),
      objective("cost", `Cost ≤ ${rupees(s.costBudget)}`, r.cost <= s.costBudget, rupees(r.cost), "A premium part is worth its price only where it matters, mainly the first stage."),
    ];
    return {
      readings: [
        gauge("snr", "Output SNR", snr, `${fmt(snr, 1)} dB`, { min: 0, max: s.snrTarget * 2, low: s.snrTarget }),
        gauge("lvl", "ADC input level", level, `${fmt(level, 1)} dBm`, { min: s.adcLow - 30, max: s.adcHigh + 20, low: s.adcLow, high: s.adcHigh }),
        info("nf", "System noise figure", `${fmt(r.nfDb, 2)} dB`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      overlay: { signal: r.signal.map((v) => Number(v.toFixed(1))), noise: r.noise.map((v) => Number(v.toFixed(1))) },
    };
  },
  explain(s, st) {
    const r = analyseChain(choiceOf(st), s.inputDbm, s.bandwidthKhz);
    return `Your chain has a ${fmt(r.nfDb, 2)} dB noise figure, ${fmt(r.totalGainDb, 1)} dB of gain and ${fmt(r.rejectionDb, 0)} dB of filtering. By the Friis formula the first stage dominates the noise, so spending on a low-noise amplifier up front lifts the SNR far more than the same money later in the chain, while the filter trades a little signal and noise for protection from the interferer.`;
  },
  fallback: (s) => ({ title: `Tune a receiver for a ${s.inputDbm} dBm signal`, story: `A telemetry receiver on a remote tower hears its signal faintly and an unwanted transmitter nearby. The engineer has to choose one part per stage within a tight power and cost budget.` }),
};
export default defineLab(lab);
