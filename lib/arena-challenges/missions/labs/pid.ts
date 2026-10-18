import { fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// A mass with viscous damping driven to a position set-point: m·x'' = u − b·x', u saturated, PID with derivative on measurement.
interface S { m: number; b: number; umax: number; osMax: number; tsMax: number }

const DT = 0.01;
const STEPS = 800;

function simulate(s: S, st: Settings) {
  const kp = Number(st.kp);
  const ki = Number(st.ki);
  const kd = Number(st.kd);
  let x = 0;
  let v = 0;
  let integ = 0;
  let peak = 0;
  let lastOut = 0;
  const trace: [number, number][] = [];
  for (let k = 0; k < STEPS; k++) {
    const e = 1 - x;
    integ = Math.max(-s.umax, Math.min(s.umax, integ + ki * e * DT));
    const u = Math.max(-s.umax, Math.min(s.umax, kp * e + integ - kd * v));
    v += ((u - s.b * v) / s.m) * DT;
    x += v * DT;
    peak = Math.max(peak, x);
    if (Math.abs(x - 1) > 0.02) lastOut = (k + 1) * DT;
    if (k % 4 === 0) trace.push([k * DT, x]);
  }
  const settled = Math.abs(x - 1) <= 0.02;
  return { overshoot: Math.max(0, peak - 1) * 100, ts: settled ? lastOut : Infinity, settled, final: x, trace };
}

const lab: Lab<S> = {
  key: "pid",
  family: "eee",
  format: "simulation",
  name: "Controller bench",
  topic: "Control Systems · PID control",
  keywords: ["control", "pid", "feedback", "servo", "automation"],
  tools: ["PID controller", "Motor and load", "Step-response plot"],
  skillTags: ["PID tuning", "Step response", "Stability"],
  makeScenario(rng, d) {
    return {
      m: rng.pick([0.5, 1, 2]), b: rng.pick([0.2, 0.5, 1]), umax: rng.pick([40, 60, 100]),
      osMax: d === "easy" ? 25 : d === "medium" ? 10 : 5,
      tsMax: d === "easy" ? 4 : d === "medium" ? 2.5 : 1.5,
    };
  },
  given: (s) => [
    { label: "Robot arm", value: `${s.m} kg moving mass, damping ${s.b} N·s/m` },
    { label: "Motor", value: `drive limited to ±${s.umax} N` },
    { label: "Task", value: "move from 0 to 1 m and hold" },
  ],
  mission: (s) => `Tune the controller so the arm reaches 1 m with under ${s.osMax}% overshoot, settles within 2% in ${s.tsMax} s and holds there.`,
  controls: () => [
    { kind: "number", id: "kp", label: "Proportional gain Kp", min: 0, max: 60, step: 2, unit: "", default: 60 },
    { kind: "number", id: "ki", label: "Integral gain Ki", min: 0, max: 40, step: 2, unit: "", default: 0 },
    { kind: "number", id: "kd", label: "Derivative gain Kd", min: 0, max: 30, step: 2, unit: "", default: 0 },
  ],
  evaluate(s, st): Outcome {
    const r = simulate(s, st);
    const objectives = [
      objective("os", `Overshoot ≤ ${s.osMax}%`, r.overshoot <= s.osMax, `${fmt(r.overshoot, 1)}% overshoot`, "A high Kp drives the arm hard and it swings past the target. What term acts like a brake on speed?"),
      objective("ts", `Settles within 2% in ${s.tsMax} s`, r.ts <= s.tsMax, Number.isFinite(r.ts) ? `settled at ${fmt(r.ts)} s` : "never settles within the 8 s test", "If the response is too slow, the push is too weak; if it keeps ringing, the damping is too little."),
      objective("hold", "Holds the target at the end", r.settled, `ends at ${fmt(r.final, 3)} m`, "A permanent gap to the target means the controller has no memory of the error. Which term removes a steady offset?"),
    ];
    return {
      readings: [
        gauge("os", "Overshoot", r.overshoot, `${fmt(r.overshoot, 1)}%`, { min: 0, max: Math.max(s.osMax * 4, r.overshoot * 1.1), high: s.osMax }),
        gauge("ts", "Settling time", Number.isFinite(r.ts) ? r.ts : 8, Number.isFinite(r.ts) ? `${fmt(r.ts)} s` : "> 8 s", { min: 0, max: 8, high: s.tsMax }),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Arm position after the command",
        xLabel: "time (s)",
        yLabel: "position (m)",
        lines: [{ name: "Position", pts: r.trace, style: "main" }, { name: "Target", pts: [[0, 1], [8, 1]], style: "limit" }],
      },
    };
  },
  explain(s, st) {
    const r = simulate(s, st);
    return `Kp pushes in proportion to the error, so a larger Kp is faster but stores more momentum and overshoots (${fmt(r.overshoot, 1)}% here). Kd opposes velocity, acting like extra damping that calms the swing. Ki accumulates leftover error so the arm finally reaches the target instead of stopping short, but too much Ki makes it overshoot and ring. Good tuning balances the three against what the load allows: with ${s.m} kg and ${s.b} N·s/m of damping, the arm ${Number.isFinite(r.ts) ? `settled in ${fmt(r.ts)} s` : "did not settle in time"}.`;
  },
  fallback: (s) => ({
    title: "Stop the oscillating robot arm",
    story: `A packing robot's arm overshoots its mark and rocks back and forth before it stops, so boxes get dropped. The ${s.m} kg arm is driven by a PID loop and the commissioning engineer has one afternoon to tune it.`,
  }),
};
export default defineLab(lab);
