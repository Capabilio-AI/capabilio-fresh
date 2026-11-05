import { choices, fmt, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Switchgear and Protection: IEC standard-inverse overcurrent relays. t = TMS · 0.14 / ((I/Is)^0.02 − 1).
interface S { load: number; faultDown: number; faultUp: number; tMaxDown: number; marginS: number }

const PLUG = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
const TMS = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.7, 1];
const opTime = (i: number, plug: number, tms: number, ctRated: number) => {
  const m = i / (plug * ctRated);
  return m <= 1.05 ? Infinity : (tms * 0.14) / (m ** 0.02 - 1);
};

function analyse(s: S, st: Settings) {
  const ct = 100; // both relays use a 100 A-rated CT secondary scale
  const down = (i: number) => opTime(i, Number(st.pd), Number(st.td), ct);
  const up = (i: number) => opTime(i, Number(st.pu), Number(st.tu), ct);
  return { down, up, tDown: down(s.faultDown), tUp: up(s.faultDown), margin: up(s.faultDown) - down(s.faultDown), tripDownLoad: down(s.load) < Infinity, tripUpLoad: up(s.load) < Infinity, upBackup: up(s.faultUp) };
}

const lab: Lab<S> = {
  key: "relay-coordination",
  family: "eee",
  format: "puzzle",
  name: "Protection relay room",
  topic: "Switchgear and Protection · Overcurrent relay coordination",
  keywords: ["switchgear", "protection", "power systems", "distribution", "relay", "high voltage"],
  tools: ["Plug setting", "Time multiplier", "Time–current plot", "Fault simulator"],
  skillTags: ["IDMT relays", "Discrimination", "Time–current curves"],
  makeScenario(rng, d) {
    const load = rng.int(8, 40) * 5;
    const faultDown = load * rng.int(8, 30);
    return { load, faultDown, faultUp: Math.round(faultDown * rng.pick([0.4, 0.5, 0.6])), tMaxDown: d === "easy" ? 0.6 : d === "medium" ? 0.45 : 0.35, marginS: d === "easy" ? 0.2 : d === "medium" ? 0.3 : 0.4 };
  },
  given: (s) => [
    { label: "Normal load", value: `${s.load} A` },
    { label: "Fault on the feeder", value: `${s.faultDown} A` },
    { label: "Fault current at the incomer", value: `${s.faultUp} A for the same fault location study` },
  ],
  mission: (s) => `Set both relays so the feeder relay clears the ${s.faultDown} A fault in ≤ ${s.tMaxDown} s, the incomer waits at least ${s.marginS} s longer as back-up, and neither trips on the ${s.load} A load.`,
  controls: () => [
    { kind: "choice", id: "pd", label: "Feeder relay plug setting", options: choices(PLUG, (v) => `${Number(v) * 100} A`), default: "0.5" },
    { kind: "choice", id: "td", label: "Feeder relay TMS", options: choices(TMS), default: "1" },
    { kind: "choice", id: "pu", label: "Incomer relay plug setting", options: choices(PLUG, (v) => `${Number(v) * 100} A`), default: "0.5" },
    { kind: "choice", id: "tu", label: "Incomer relay TMS", options: choices(TMS), default: "0.05" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("fast", `Feeder relay trips in ≤ ${s.tMaxDown} s`, a.tDown <= s.tMaxDown, Number.isFinite(a.tDown) ? `${fmt(a.tDown, 2)} s` : "does not pick up", "Operating time scales with TMS and falls as the fault current rises above the plug setting."),
      objective("disc", `Incomer waits ≥ ${s.marginS} s longer`, a.margin >= s.marginS, Number.isFinite(a.margin) ? `${fmt(a.margin, 2)} s margin` : "incomer does not operate", "The upstream relay must be slower, so only the faulty feeder is disconnected."),
      objective("load", "No trip on normal load", !a.tripDownLoad && !a.tripUpLoad, a.tripDownLoad || a.tripUpLoad ? "a relay would trip on load" : "load is below both pick-ups", "A plug setting below the load current picks up on healthy load."),
    ];
    const curve = (f: (i: number) => number): [number, number][] =>
      Array.from({ length: 41 }, (_, i) => {
        const cur = 10 ** (Math.log10(s.load * 1.2) + (i / 40) * (Math.log10(s.faultDown * 2) - Math.log10(s.load * 1.2)));
        return [Number(Math.log10(cur).toFixed(3)), Math.log10(Math.min(100, Math.max(0.02, f(cur))))];
      });
    return {
      readings: [info("td", "Feeder trip time", Number.isFinite(a.tDown) ? `${fmt(a.tDown, 2)} s` : "no trip"), info("tu", "Incomer trip time", Number.isFinite(a.tUp) ? `${fmt(a.tUp, 2)} s` : "no trip")],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Time–current curves", xLabel: "log10 current (A)", yLabel: "log10 time (s)", lines: [{ name: "Feeder relay", pts: curve(a.down), style: "main" }, { name: "Incomer relay", pts: curve(a.up), style: "ref" }, { name: "Fault", pts: [[Math.log10(s.faultDown), -1.7], [Math.log10(s.faultDown), 2]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `At ${s.faultDown} A the feeder relay clears the fault in ${fmt(a.tDown, 2)} s and the incomer would take ${fmt(a.tUp, 2)} s, a margin of ${fmt(a.margin, 2)} s. Coordination means the two curves never cross over the range of possible faults: the nearer relay always wins, and the upstream one only operates if it fails. Both plug settings must stay above the load current or the relays would trip on healthy load.`;
  },
  fallback: (s) => ({ title: `Stop the ${s.faultDown} A fault from blacking out the town`, story: `A short circuit on one feeder keeps tripping the whole substation. The protection engineer must re-set two overcurrent relays so only the faulty feeder is isolated.` }),
};
export default defineLab(lab);
