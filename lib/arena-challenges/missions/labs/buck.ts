import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Buck converter. Continuous conduction: Vout = D·Vin. Discontinuous: M = 2/(1+sqrt(1+4K/D²)), K = 2L/(R·T).
interface S { vin: number; d0: number; vout: number; iout: number; ripIPct: number; ripVmV: number; etaMin: number }

const RDS = 0.05; // switch on-resistance (Ω)
const VF = 0.5; // freewheeling Schottky drop (V)
const TSW = 60e-9; // switch rise + fall time (s)

function analyse(s: S, st: Settings) {
  const D = Number(st.duty) / 100;
  const L = Number(st.l) * 1e-6;
  const C = Number(st.c) * 1e-6;
  const f = Number(st.f) * 1e3;
  const T = 1 / f;
  const R = s.vout / s.iout;
  const K = (2 * L) / (R * T);
  const ccm = K >= 1 - D;
  const M = ccm ? D : 2 / (1 + Math.sqrt(1 + (4 * K) / (D * D)));
  const vo = M * s.vin;
  const dIL = ((s.vin - vo) * D * T) / L;
  const esr = 4 / Number(st.c);
  const dV = dIL / (8 * f * C) + dIL * esr;
  const io = vo / R;
  const pOut = vo * io;
  const dcr = 0.0004 * Number(st.l);
  const loss = io * io * RDS * D + VF * io * (1 - D) + io * io * dcr + 0.5 * s.vin * io * TSW * f * 2;
  const eta = (pOut / (pOut + loss)) * 100;
  return { D, T, ccm, vo, dIL, dV, eta, io };
}

const lab: Lab<S> = {
  key: "buck",
  family: "eee",
  format: "simulation",
  name: "Converter bench",
  topic: "Power Electronics · DC-DC converters",
  keywords: ["power electronics", "converter", "chopper", "smps", "dc-dc", "switching"],
  tools: ["Switch (MOSFET)", "Diode", "Inductor", "Output capacitor", "Scope"],
  skillTags: ["Buck converter", "Inductor ripple", "Switching losses"],
  makeScenario(rng, d) {
    const vin = rng.pick([12, 24, 36, 48]);
    const d0 = rng.int(4, 15) * 5;
    return {
      vin, d0, vout: Number(((vin * d0) / 100).toFixed(2)), iout: rng.pick([1, 2, 3, 5]),
      ripIPct: d === "easy" ? 40 : d === "medium" ? 30 : 20,
      ripVmV: d === "easy" ? 200 : d === "medium" ? 100 : 50,
      etaMin: d === "easy" ? 88 : d === "medium" ? 92 : 94,
    };
  },
  given: (s) => [
    { label: "Input", value: `${s.vin} V DC` },
    { label: "Load", value: `${s.iout} A at ${fmt(s.vout, 1)} V` },
    { label: "Losses modelled", value: "switch resistance, diode drop, inductor winding, switching" },
  ],
  mission: (s) => `Step ${s.vin} V down to ${fmt(s.vout, 1)} V (±2%) with current ripple under ${s.ripIPct}%, output ripple under ${s.ripVmV} mV and efficiency above ${s.etaMin}%.`,
  controls: (s) => [
    { kind: "number", id: "duty", label: "Duty cycle", min: 5, max: 95, step: 1, unit: "%", default: 50, focus: [s.d0] },
    { kind: "choice", id: "l", label: "Inductor", options: choices([22, 47, 100, 220, 470, 1000], (v) => `${v} µH`), default: "22" },
    { kind: "choice", id: "c", label: "Output capacitor", options: choices([47, 100, 220, 470, 1000], (v) => `${v} µF`), default: "47" },
    { kind: "choice", id: "f", label: "Switching frequency", options: choices([20, 50, 100, 200], (v) => `${v} kHz`), default: "20" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const err = (Math.abs(a.vo - s.vout) / s.vout) * 100;
    const dILpct = (a.dIL / s.iout) * 100;
    const objectives = [
      objective("vout", `Output within 2% of ${fmt(s.vout, 1)} V`, err <= 2, `${fmt(a.vo)} V (${fmt(err, 1)}% off)`, "In steady state the output is the input times the duty cycle, as long as the inductor current never reaches zero."),
      objective("mode", "Inductor current never reaches zero", a.ccm, a.ccm ? "continuous conduction" : "discontinuous: current falls to zero", "At light load or with a small inductor the current hits zero each cycle and the output no longer follows D. What helps keep the current flowing?"),
      objective("ripI", `Inductor ripple ≤ ${s.ripIPct}% of load current`, dILpct <= s.ripIPct, `${fmt(dILpct, 0)}%`, "Ripple current is (Vin − Vout)·D / (L·f). Two parts of the formula are yours to choose."),
      objective("ripV", `Output ripple ≤ ${s.ripVmV} mV`, a.dV * 1000 <= s.ripVmV, `${fmt(a.dV * 1000, 0)} mV`, "The capacitor smooths the inductor ripple. A bigger capacitor or less ripple current both help."),
      objective("eta", `Efficiency ≥ ${s.etaMin}%`, a.eta >= s.etaMin, `${fmt(a.eta, 1)}%`, "Bigger inductors have more winding resistance and faster switching wastes energy. Where is the sweet spot?"),
    ];
    const iMin = Math.max(0, a.io - a.dIL / 2);
    const iMax = a.io + a.dIL / 2;
    const td = a.ccm ? (1 - a.D) * a.T : Math.min((1 - a.D) * a.T, (a.D * a.T * (s.vin - a.vo)) / a.vo);
    const pk = a.ccm ? iMax : a.dIL;
    const start = a.ccm ? iMin : 0;
    const cycle = (t0: number): [number, number][] => [[t0, start], [t0 + a.D * a.T, pk], [t0 + a.D * a.T + td, a.ccm ? iMin : 0], [t0 + a.T, a.ccm ? iMin : 0]];
    return {
      readings: [
        gauge("vo", "Output voltage", a.vo, `${fmt(a.vo)} V`, { min: 0, max: s.vin, low: s.vout * 0.98, high: s.vout * 1.02 }),
        gauge("dIL", "Inductor ripple", dILpct, `${fmt(dILpct, 0)}% of load`, { min: 0, max: Math.max(s.ripIPct * 3, dILpct * 1.1), high: s.ripIPct }),
        gauge("dV", "Output ripple", a.dV * 1000, `${fmt(a.dV * 1000, 0)} mV`, { min: 0, max: Math.max(s.ripVmV * 3, a.dV * 1100), high: s.ripVmV }),
        gauge("eta", "Efficiency", a.eta, `${fmt(a.eta, 1)}%`, { min: 70, max: 100, low: s.etaMin }),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Inductor current over two switching cycles",
        xLabel: "time (µs)",
        yLabel: "amps",
        lines: [{ name: "Inductor current", pts: [...cycle(0), ...cycle(a.T)].map(([t, i]) => [t * 1e6, i] as [number, number]), style: "main" }, { name: "Load current", pts: [[0, a.io], [2 * a.T * 1e6, a.io]], style: "ref" }],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `With the switch on for ${fmt(a.D * 100, 0)}% of each ${fmt(a.T * 1e6, 1)} µs cycle, the inductor current ramps up by ΔI = (Vin − Vout)·D/(L·f) = ${fmt(a.dIL)} A and back down, and the output settles at D·Vin = ${fmt(a.vo)} V while the current stays continuous. The capacitor then smooths that triangle into ${fmt(a.dV * 1000, 0)} mV of ripple. A larger inductor or a higher frequency shrinks both ripples, but winding resistance and switching loss grow, which is why efficiency was ${fmt(a.eta, 1)}% and the best design is a balance, not a maximum.`;
  },
  fallback: (s) => ({
    title: `Build a ${fmt(s.vout, 1)} V charger rail`,
    story: `A solar charge controller must feed a ${fmt(s.vout, 1)} V battery from a ${s.vin} V source, and the first prototype ran hot and buzzed. The designer can choose the duty cycle, the inductor, the output capacitor and the switching frequency.`,
  }),
};
export default defineLab(lab);
