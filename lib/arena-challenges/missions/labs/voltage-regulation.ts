import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Radial feeder in per-unit on 10 MVA. Receiving voltage from Vr² − Vs·Vr + (R·P + X·Q) = 0, with Q net of the shunt capacitor bank.
interface S { r: number; x: number; p: number; pf: number; offFactor: number; lossMaxPct: number; capMax: number }

const BASE = 10;
function at(s: S, st: Settings, load: number) {
  const vs = 1 + Number(st.tap) / 100;
  const p = s.p * load;
  const q = p * Math.tan(Math.acos(s.pf)) - Number(st.cap) / BASE;
  const disc = vs * vs - 4 * (s.r * p + s.x * q);
  if (disc < 0) return { vr: 0, lossPct: Infinity };
  const vr = (vs + Math.sqrt(disc)) / 2;
  return { vr, lossPct: ((s.r * (p * p + q * q)) / (vr * vr) / p) * 100 };
}

const lab: Lab<S> = {
  key: "voltage-regulation",
  family: "eee",
  format: "decision",
  name: "Feeder control room",
  topic: "Power Systems · Voltage control",
  keywords: ["power system", "transmission", "distribution", "voltage", "reactive", "load flow"],
  tools: ["Tap changer", "Capacitor bank", "Voltage profile"],
  skillTags: ["Voltage regulation", "Reactive power", "Feeder losses"],
  makeScenario(rng, d) {
    return {
      r: rng.pick([0.04, 0.05, 0.06, 0.07]), x: rng.pick([0.08, 0.1, 0.12, 0.15]), p: rng.pick([0.6, 0.7, 0.8, 0.9]), pf: rng.pick([0.8, 0.85, 0.9]),
      offFactor: rng.pick([0.2, 0.25, 0.3]), lossMaxPct: d === "easy" ? 8 : d === "medium" ? 5 : 4, capMax: d === "easy" ? 4 : d === "medium" ? 3 : 2,
    };
  },
  given: (s) => [
    { label: "Peak load", value: `${fmt(s.p * BASE, 1)} MW at ${s.pf} lagging` },
    { label: "Night load", value: `${fmt(s.offFactor * 100, 0)}% of peak, same power factor` },
    { label: "Feeder", value: `R = ${s.r} pu, X = ${s.x} pu (10 MVA base)` },
    { label: "Supply", value: "1.00 pu before the tap changer" },
  ],
  mission: (s) => `Keep the campus voltage between 0.95 and 1.05 pu at peak and at night, with losses under ${s.lossMaxPct}% of peak load and at most ${s.capMax} MVAr of capacitors.`,
  controls: () => [
    { kind: "choice", id: "tap", label: "Transformer tap", options: choices([-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10], (v) => `${Number(v) > 0 ? "+" : ""}${v}%`), default: "0" },
    { kind: "number", id: "cap", label: "Capacitor bank", min: 0, max: 5, step: 1, unit: "MVAr", default: 0 },
  ],
  evaluate(s, st): Outcome {
    const peak = at(s, st, 1);
    const night = at(s, st, s.offFactor);
    const inBand = (v: number) => v >= 0.95 && v <= 1.05;
    const objectives = [
      objective("peak", "Voltage within 0.95–1.05 pu at peak", inBand(peak.vr), peak.vr ? `${fmt(peak.vr, 3)} pu` : "voltage collapse", "At peak the heavy lagging current drops voltage along the feeder. How can you raise the sending end or cut the reactive current?"),
      objective("night", "Voltage within 0.95–1.05 pu at night", inBand(night.vr), `${fmt(night.vr, 3)} pu`, "At night the feeder drops little voltage, so what you added for peak can push it too high. Is the capacitor bank or the tap too generous?"),
      objective("loss", `Peak losses ≤ ${s.lossMaxPct}% of load`, peak.lossPct <= s.lossMaxPct, Number.isFinite(peak.lossPct) ? `${fmt(peak.lossPct, 1)}%` : "n/a", "Losses follow the current squared. Supplying reactive power locally reduces the current the feeder must carry."),
      objective("cap", `Capacitors ≤ ${s.capMax} MVAr`, Number(st.cap) <= s.capMax, `${st.cap} MVAr installed`, "The capital budget limits the bank. Can the tap changer do part of the work?"),
    ];
    const pts = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((l): [number, number] => [l * 100, at(s, st, l).vr]);
    return {
      readings: [
        gauge("peak", "Peak voltage", peak.vr, `${fmt(peak.vr, 3)} pu`, { min: 0.85, max: 1.15, low: 0.95, high: 1.05 }),
        gauge("night", "Night voltage", night.vr, `${fmt(night.vr, 3)} pu`, { min: 0.85, max: 1.15, low: 0.95, high: 1.05 }),
        gauge("loss", "Peak losses", Number.isFinite(peak.lossPct) ? peak.lossPct : 20, Number.isFinite(peak.lossPct) ? `${fmt(peak.lossPct, 1)}%` : "n/a", { min: 0, max: Math.max(s.lossMaxPct * 3, 12), high: s.lossMaxPct }),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Campus voltage through the day",
        xLabel: "load (% of peak)",
        yLabel: "voltage (pu)",
        lines: [{ name: "Voltage", pts, style: "main" }, { name: "Upper limit", pts: [[10, 1.05], [100, 1.05]], style: "limit" }, { name: "Lower limit", pts: [[10, 0.95], [100, 0.95]], style: "limit" }],
      },
    };
  },
  explain(s, st) {
    const peak = at(s, st, 1);
    const night = at(s, st, s.offFactor);
    return `The feeder drops about (R·P + X·Q)/V in voltage, and the reactive term X·Q is large because the load is lagging. A tap raises the whole profile, while a capacitor bank cancels reactive current locally, which both lifts the voltage and cuts I²R losses (${fmt(peak.lossPct, 1)}% at peak here). But both help most when the load is light and the drop is small, so what rescues the peak at ${fmt(peak.vr, 3)} pu can overshoot at night (${fmt(night.vr, 3)} pu). Voltage control is always a compromise across the whole load curve.`;
  },
  fallback: () => ({
    title: "Brownout at the campus",
    story: "Lights dim in the hostels every evening and the lab equipment trips at night when the load drops. The distribution engineer controls one transformer tap and one capacitor bank for the whole campus feeder.",
  }),
};
export default defineLab(lab);
