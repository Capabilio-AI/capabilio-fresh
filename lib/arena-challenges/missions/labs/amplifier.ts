import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Common-emitter amplifier with voltage-divider bias and a bypassed emitter. β = 100, VBE = 0.7 V. Small-signal gain = gm·RC with gm = IC / 25 mV.
interface S { vcc: number; gainMin: number; driftMaxPct: number; supplyMaxMa: number }

const VBE = 0.7;
const VT = 0.025;
function bias(vcc: number, st: Settings, beta: number) {
  const r1 = Number(st.r1);
  const r2 = Number(st.r2);
  const vth = (vcc * r2) / (r1 + r2);
  const rth = (r1 * r2) / (r1 + r2);
  const re = Number(st.re);
  const ib = Math.max(0, (vth - VBE) / (rth + (beta + 1) * re));
  return { ic: beta * ib, vth };
}
function analyse(s: S, st: Settings) {
  const rc = Number(st.rc);
  const re = Number(st.re);
  const { ic } = bias(s.vcc, st, 100);
  const ic200 = bias(s.vcc, st, 200).ic;
  const vce = s.vcc - ic * (rc + re);
  const gain = (ic / VT) * rc;
  const drift = ic > 0 ? ((ic200 - ic) / ic) * 100 : 100;
  const supply = ic + s.vcc / (Number(st.r1) + Number(st.r2));
  return { ic, vce, gain, drift, supply, rc };
}

const lab: Lab<S> = {
  key: "amplifier",
  family: "ece",
  format: "simulation",
  name: "Amplifier bench",
  topic: "Analog Electronics · BJT biasing and gain",
  keywords: ["analog", "electronic devices", "electronic circuits", "amplifier", "transistor", "bjt", "linear ic"],
  tools: ["Bias resistors", "Collector and emitter resistors", "Multimeter", "Oscilloscope"],
  skillTags: ["BJT biasing", "Q-point", "Amplifier gain"],
  makeScenario(rng, d) {
    return {
      vcc: rng.pick([9, 12, 15]),
      gainMin: d === "easy" ? 60 : d === "medium" ? 100 : 130,
      driftMaxPct: d === "easy" ? 25 : d === "medium" ? 15 : 10,
      supplyMaxMa: d === "easy" ? 4 : d === "medium" ? 3 : 2.5,
    };
  },
  given: (s) => [
    { label: "Supply", value: `${s.vcc} V` },
    { label: "Transistor", value: "β = 100 (it can be 200 in another batch), VBE = 0.7 V" },
    { label: "Emitter", value: "bypassed by a capacitor for the signal" },
  ],
  mission: (s) => `Set the bias so the transistor sits near mid-supply, gives a voltage gain of at least ${s.gainMin}, stays stable if β doubles (collector current up by at most ${s.driftMaxPct}%) and draws at most ${s.supplyMaxMa} mA.`,
  controls: () => [
    { kind: "choice", id: "r1", label: "R1 (top of divider)", options: choices([22, 33, 47, 68, 82, 100], (v) => `${v} kΩ`), default: "100" },
    { kind: "choice", id: "r2", label: "R2 (bottom of divider)", options: choices([4.7, 6.8, 10, 15, 22], (v) => `${v} kΩ`), default: "4.7" },
    { kind: "choice", id: "rc", label: "Collector resistor RC", options: choices([1, 1.5, 2.2, 3.3, 4.7], (v) => `${v} kΩ`), default: "1" },
    { kind: "choice", id: "re", label: "Emitter resistor RE", options: choices([0.22, 0.33, 0.47, 0.68, 1, 1.5, 2.2], (v) => `${v} kΩ`), default: "2.2" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const mid = a.vce >= 0.4 * s.vcc && a.vce <= 0.6 * s.vcc;
    const objectives = [
      objective("q", "Q-point near mid-supply (VCE 40–60% of supply)", mid, `VCE = ${fmt(a.vce, 2)} V of ${s.vcc} V`, "If VCE is near zero the transistor is saturated; if it is near the supply it is almost off. Which resistors set the collector current?"),
      objective("gain", `Voltage gain ≥ ${s.gainMin}`, a.gain >= s.gainMin, `${fmt(a.gain, 0)}`, "With the emitter bypassed, gain is the transconductance times RC, and transconductance follows the collector current."),
      objective("drift", `Stable if β doubles (IC rises ≤ ${s.driftMaxPct}%)`, a.drift <= s.driftMaxPct, `+${fmt(a.drift, 0)}%`, "A stiff divider and a larger emitter resistor make the bias depend on the resistors instead of on β."),
      objective("supply", `Supply current ≤ ${s.supplyMaxMa} mA`, a.supply <= s.supplyMaxMa, `${fmt(a.supply, 2)} mA`, "The divider wastes current of its own, in addition to the collector current."),
    ];
    const pts = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3].map((m): [number, number] => [m, Math.max(0, s.vcc - m * (a.rc + Number(st.re)))]);
    return {
      readings: [
        gauge("vce", "Collector–emitter voltage", a.vce, `${fmt(a.vce, 2)} V`, { min: 0, max: s.vcc, low: 0.4 * s.vcc, high: 0.6 * s.vcc }),
        gauge("gain", "Voltage gain", a.gain, fmt(a.gain, 0), { min: 0, max: Math.max(s.gainMin * 2, a.gain * 1.1), low: s.gainMin }),
        gauge("drift", "IC rise if β doubles", Math.min(a.drift, 100), `+${fmt(a.drift, 0)}%`, { min: 0, max: 60, high: s.driftMaxPct }),
        info("ic", "Collector current", `${fmt(a.ic, 2)} mA`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "DC load line",
        xLabel: "collector current (mA)",
        yLabel: "VCE (V)",
        lines: [{ name: "Load line", pts, style: "main" }, { name: "Your Q-point", pts: [[a.ic, 0], [a.ic, s.vcc]], style: "ref" }, { name: "Mid-supply", pts: [[0.25, s.vcc / 2], [3, s.vcc / 2]], style: "limit" }],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The divider sets the base voltage and the emitter resistor turns it into a collector current of ${fmt(a.ic, 2)} mA. That current drops ${fmt(a.ic * (a.rc + Number(st.re)), 1)} V across RC and RE, leaving VCE = ${fmt(a.vce, 1)} V, which decides how much the output can swing without clipping. Gain is gm·RC with gm = IC/25 mV, so it comes to ${fmt(a.gain, 0)}. A stiff divider and a decent emitter resistor make IC depend on the resistors rather than on β, which is why it rose by only ${fmt(a.drift, 0)}% when β doubled.`;
  },
  fallback: (s) => ({
    title: `Bias a ${s.vcc} V amplifier stage`,
    story: "A sensor board's preamplifier clips and drifts when the transistor batch changes. You can change the four resistors around the transistor and check it on the bench.",
  }),
};
export default defineLab(lab);
