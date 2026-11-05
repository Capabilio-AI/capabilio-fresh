import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Induction and Synchronous Machines: torque–speed from the per-phase equivalent circuit (magnetising branch neglected). 415 V, 50 Hz, 4 pole.
interface S { loadNm: number; startRatio: number; slipMaxPct: number; iStartMax: number }

const VPH = 415 / Math.sqrt(3);
const WS = (2 * Math.PI * 1500) / 60;
const R1 = 0.6;
const X = 2.2;
const R2S = [0.3, 0.5, 0.8, 1.2, 1.8, 2.5];
const VS = [70, 80, 90, 100, 110];
const torque = (v: number, r2: number, s: number) => (3 * v * v * (r2 / s)) / (WS * ((R1 + r2 / s) ** 2 + X * X));
const current = (r2: number, s: number, v: number) => v / Math.hypot(R1 + r2 / s, X);

function analyse(s: S, st: Settings) {
  const r2 = Number(st.r2);
  const v = (VPH * Number(st.v)) / 100;
  const sMax = r2 / Math.hypot(R1, X);
  let slip = NaN;
  let lo = 1e-4;
  let hi = sMax;
  if (torque(v, r2, hi) >= s.loadNm) {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (torque(v, r2, mid) < s.loadNm) lo = mid;
      else hi = mid;
    }
    slip = ((lo + hi) / 2) * 100;
  }
  return { r2, v, tStart: torque(v, r2, 1), tMax: torque(v, r2, sMax), slip, sMax, iStart: current(r2, 1, v), vPct: Number(st.v) };
}

const lab: Lab<S> = {
  key: "induction-motor",
  family: "eee",
  format: "simulation",
  name: "Motor test bench",
  topic: "Induction and Synchronous Machines · Torque–speed characteristic",
  keywords: ["induction", "synchronous machines", "electrical machines", "electric drives", "motor"],
  tools: ["Rotor resistance box", "Supply autotransformer", "Dynamometer", "Torque–speed plot"],
  skillTags: ["Slip", "Starting torque", "Breakdown torque"],
  makeScenario(rng, d) {
    const base: S = { loadNm: 0, startRatio: 0, slipMaxPct: 0, iStartMax: 0 };
    const refs = [...gridSettings(lab.controls(base))].map((st) => ({ st, a: analyse(base, { ...st }) }));
    const ref = rng.pick(refs.filter((r) => Number(r.st.v) >= 90));
    const loadNm = Math.round(analyse(base, ref.st).tMax * rng.int(25, 55) / 100);
    const a = analyse({ ...base, loadNm }, ref.st);
    const k = d === "easy" ? 1.3 : d === "medium" ? 1.12 : 1.03;
    return { loadNm, startRatio: Number(((a.tStart / loadNm) / k).toFixed(2)), slipMaxPct: Number((a.slip * k).toFixed(1)), iStartMax: Math.ceil(a.iStart * k) };
  },
  given: (s) => [
    { label: "Motor", value: "415 V, 50 Hz, 4-pole slip-ring induction motor" },
    { label: "Load torque", value: `${s.loadNm} N·m, constant` },
    { label: "Mains limit", value: `starting current ≤ ${s.iStartMax} A per phase` },
  ],
  mission: (s) => `Choose rotor resistance and supply voltage so the motor starts the ${s.loadNm} N·m load (starting torque ≥ ${s.startRatio}× load), runs at slip ≤ ${s.slipMaxPct}%, and draws ≤ ${s.iStartMax} A at start.`,
  controls: () => [
    { kind: "choice", id: "r2", label: "Rotor resistance (per phase)", options: choices(R2S, (v) => `${v} Ω`), default: "0.3" },
    { kind: "choice", id: "v", label: "Supply voltage", options: choices(VS, (v) => `${v}%`), default: "70" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("start", `Starting torque ≥ ${s.startRatio}× load`, a.tStart >= s.startRatio * s.loadNm, `${fmt(a.tStart, 1)} N·m (${fmt(a.tStart / s.loadNm)}×)`, "Starting torque grows with rotor resistance, up to the point where breakdown happens at standstill."),
      objective("slip", `Running slip ≤ ${s.slipMaxPct}%`, Number.isFinite(a.slip) && a.slip <= s.slipMaxPct, Number.isFinite(a.slip) ? `${fmt(a.slip, 1)}%` : "load exceeds breakdown torque", "Large rotor resistance wastes power as heat and makes the motor droop under load."),
      objective("curr", `Starting current ≤ ${s.iStartMax} A`, a.iStart <= s.iStartMax, `${fmt(a.iStart, 0)} A`, "Starting current falls with extra rotor resistance and with reduced voltage."),
    ];
    const pts: [number, number][] = Array.from({ length: 81 }, (_, i) => {
      const sl = Math.max(0.005, 1 - i / 80);
      return [Number((1500 * (1 - sl)).toFixed(0)), torque(a.v, a.r2, sl)];
    });
    return {
      readings: [info("tmax", "Breakdown torque", `${fmt(a.tMax, 0)} N·m`), gauge("ts", "Starting torque", a.tStart, `${fmt(a.tStart, 0)} N·m`, { min: 0, max: Math.max(a.tMax * 1.1, s.loadNm * 3), low: s.startRatio * s.loadNm }), gauge("ist", "Starting current", a.iStart, `${fmt(a.iStart, 0)} A`, { min: 0, max: s.iStartMax * 2, high: s.iStartMax })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Torque–speed curve", xLabel: "speed (rpm)", yLabel: "torque (N·m)", lines: [{ name: "Motor torque", pts, style: "main" }, { name: "Load", pts: [[0, s.loadNm], [1500, s.loadNm]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The motor produces ${fmt(a.tStart, 0)} N·m at standstill and at most ${fmt(a.tMax, 0)} N·m near ${fmt(a.sMax * 100, 0)}% slip. The load line cuts the curve where the motor runs: ${Number.isFinite(a.slip) ? `slip ${fmt(a.slip, 1)}%` : "it cannot, the load is above breakdown torque"}. Rotor resistance moves the peak toward standstill, giving high starting torque and low starting current, but it increases slip when running. That is why slip-ring motors short the resistance out once they are up to speed.`;
  },
  fallback: (s) => ({ title: `Start the ${s.loadNm} N·m crusher`, story: `A stone crusher must start under load on a weak rural feeder, so the motor can only draw ${s.iStartMax} A when it starts. The plant electrician can set the rotor resistance and the supply voltage.` }),
};
export default defineLab(lab);
