import { fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// DC shunt motor, 220 V. Back-emf E = kΦ·N. At standstill Ia = V / (Ra + Rs). Torque ∝ Φ·Ia, speed N = (V − Ia·(Ra + Rs)) / kΦ.
interface S { ra: number; iRated: number; loadFrac: number; ratedRpm: number; iStartMaxX: number; torqueRatio: number; rpmLow: number; rpmHigh: number }

const V = 220;
const FIELD: Record<string, { name: string; phi: number }> = { strong: { name: "Strong field (110%)", phi: 1.1 }, normal: { name: "Rated field (100%)", phi: 1 }, weak: { name: "Weak field (90%)", phi: 0.9 } };
const kPhi = (s: S) => (V - s.iRated * s.ra) / s.ratedRpm;

function analyse(s: S, st: Settings) {
  const f = FIELD[String(st.field)];
  const load = s.iRated * s.loadFrac;
  const iStart = V / (s.ra + Number(st.rs1));
  const torqueRatio = (f.phi * iStart) / load; // starting torque over load torque
  const rpm = (V - load * (s.ra + Number(st.rs2))) / (kPhi(s) * f.phi);
  return { f, load, iStart, torqueRatio, rpm };
}

const lab: Lab<S> = {
  key: "dc-motor",
  family: "eee",
  format: "lab",
  name: "Motor starter panel",
  topic: "Electrical Machines · DC motor starting and speed",
  keywords: ["electrical machines", "dc machines", "motor", "machines", "drives", "electromechanical"],
  tools: ["Starter resistance", "Run resistance", "Field regulator", "Ammeter and tachometer"],
  skillTags: ["DC motor starting", "Back-emf", "Field control"],
  makeScenario(rng, d) {
    const ra = rng.pick([0.4, 0.5, 0.6, 0.8]);
    const iRated = rng.pick([16, 20, 25, 30]);
    const ratedRpm = rng.pick([1200, 1500, 1800]);
    const center = ratedRpm * rng.pick([0.96, 1, 1.04]);
    const half = d === "easy" ? 0.06 : d === "medium" ? 0.035 : 0.025;
    return {
      ra, iRated, ratedRpm, loadFrac: rng.pick([0.7, 0.8, 0.9]), iStartMaxX: d === "easy" ? 2.4 : d === "medium" ? 2 : 1.8,
      torqueRatio: d === "easy" ? 1.3 : d === "medium" ? 1.5 : 1.7, rpmLow: Math.round(center * (1 - half)), rpmHigh: Math.round(center * (1 + half)),
    };
  },
  given: (s) => [
    { label: "Supply", value: "220 V DC" },
    { label: "Motor", value: `${s.iRated} A rated at ${s.ratedRpm} rpm, armature resistance ${s.ra} Ω` },
    { label: "Load", value: `${Math.round(s.loadFrac * 100)}% of rated current once running, steady torque` },
  ],
  mission: (s) => `Start the motor with at most ${fmt(s.iStartMaxX * s.iRated, 0)} A, with a starting torque at least ${s.torqueRatio}× the load torque, then run it between ${s.rpmLow} and ${s.rpmHigh} rpm.`,
  controls: () => [
    { kind: "number", id: "rs1", label: "Starter resistance", min: 0, max: 15, step: 1, unit: "Ω", default: 0 },
    { kind: "number", id: "rs2", label: "Resistance left in at run", min: 0, max: 2, step: 0.25, unit: "Ω", default: 0 },
    { kind: "choice", id: "field", label: "Field setting", options: Object.entries(FIELD).map(([value, f]) => ({ value, label: f.name })), default: "normal" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const iMax = s.iStartMaxX * s.iRated;
    const objectives = [
      objective("istart", `Starting current ≤ ${fmt(iMax, 0)} A`, a.iStart <= iMax, `${fmt(a.iStart, 0)} A`, "At standstill there is no back-emf, so only the armature and starter resistance limit the current."),
      objective("torque", `Starting torque ≥ ${s.torqueRatio}× load torque`, a.torqueRatio >= s.torqueRatio, `${fmt(a.torqueRatio, 2)}×`, "Torque follows field flux times armature current. Too much starter resistance, or a weak field, leaves it short."),
      objective("rpm", `Running speed ${s.rpmLow}–${s.rpmHigh} rpm`, a.rpm >= s.rpmLow && a.rpm <= s.rpmHigh, `${fmt(a.rpm, 0)} rpm`, "Speed rises when the field is weakened and falls when resistance stays in series with the armature."),
    ];
    const pts = Array.from({ length: 16 }, (_, i): [number, number] => [i, V / (s.ra + i)]);
    return {
      readings: [
        gauge("istart", "Starting current", a.iStart, `${fmt(a.iStart, 0)} A`, { min: 0, max: Math.max(iMax * 1.6, a.iStart * 1.1), high: iMax }),
        gauge("torque", "Starting torque ÷ load torque", a.torqueRatio, `${fmt(a.torqueRatio, 2)}×`, { min: 0, max: Math.max(s.torqueRatio * 2, a.torqueRatio * 1.1), low: s.torqueRatio }),
        gauge("rpm", "Running speed", a.rpm, `${fmt(a.rpm, 0)} rpm`, { min: s.ratedRpm * 0.7, max: s.ratedRpm * 1.3, low: s.rpmLow, high: s.rpmHigh }),
        info("load", "Load current", `${fmt(a.load, 1)} A`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Starting current against starter resistance",
        xLabel: "starter resistance (Ω)",
        yLabel: "starting current (A)",
        lines: [{ name: "Starting current", pts, style: "main" }, { name: "Limit", pts: [[0, iMax], [15, iMax]], style: "limit" }, { name: "Your setting", pts: [[Number(st.rs1), 0], [Number(st.rs1), V / s.ra]], style: "ref" }],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `At standstill the back-emf is zero, so the starting current is V/(Ra + Rs) = ${fmt(a.iStart, 0)} A. The starter resistance exists to cut that current to a safe value, but torque is proportional to flux times armature current, so too much resistance cannot even turn the load (${fmt(a.torqueRatio, 2)}× the load torque here). Once running, back-emf supplies most of the opposing voltage, and the speed settles where N = (V − Ia(Ra + Rs)) / kΦ, which is ${fmt(a.rpm, 0)} rpm. Weakening the field raises speed and strengthening it lowers speed.`;
  },
  fallback: (s) => ({
    title: `Start a ${s.ratedRpm} rpm DC motor`,
    story: "A conveyor motor trips its supply every time it starts. You can set the starter resistance, what stays in at run speed and the field strength, and watch the current, torque and speed.",
  }),
};
export default defineLab(lab);
