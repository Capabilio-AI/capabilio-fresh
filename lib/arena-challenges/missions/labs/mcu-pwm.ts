import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Microprocessors and Embedded Systems: timer PWM. f = fcpu / (prescaler · (TOP + 1)); resolution = log2(TOP + 1) bits.
interface S { fcpuMhz: number; targetHz: number; tolPct: number; dutyPct: number; dutyTolPct: number; bitsMin: number }

const PRESCALERS = [1, 8, 64, 256, 1024];
const TOPS = [15, 31, 63, 99, 127, 199, 255, 399, 511, 799, 999, 1023, 1999, 2047, 3999, 4095, 7999, 9999, 16383, 19999, 39999, 65535];
const DUTIES = Array.from({ length: 21 }, (_, i) => i * 5);

function analyse(s: S, st: Settings) {
  const ps = Number(st.ps);
  const top = Number(st.top);
  const steps = top + 1;
  const compare = Math.round((Number(st.duty) / 100) * steps);
  const f = (s.fcpuMhz * 1e6) / (ps * steps);
  return { ps, top, f, errPct: (Math.abs(f - s.targetHz) / s.targetHz) * 100, bits: Math.log2(steps), duty: (compare / steps) * 100, dutyErr: Math.abs((compare / steps) * 100 - s.dutyPct), compare, steps };
}

const lab: Lab<S> = {
  key: "mcu-pwm",
  family: "ece",
  format: "simulation",
  name: "Microcontroller bench",
  topic: "Microprocessors and Embedded Systems · Timers and PWM",
  keywords: ["microprocessor", "microcontroller", "embedded", "internet of things", "vlsi", "instrumentation"],
  tools: ["Timer registers", "Prescaler", "Logic analyser", "Frequency counter"],
  skillTags: ["Timer/counter", "PWM", "Prescaler arithmetic"],
  makeScenario(rng, d) {
    const fcpuMhz = rng.pick([1, 4, 8, 12, 16, 20, 48, 72]);
    // pick a reachable target from a random reference setting, so the mission can always be won
    const ps = rng.pick(PRESCALERS);
    const top = rng.pick(TOPS);
    const targetHz = Math.round(((fcpuMhz * 1e6) / (ps * (top + 1))) * (1 + rng.int(-2, 2) / 100) * 10) / 10;
    return { fcpuMhz, targetHz: Math.max(1, targetHz), tolPct: d === "easy" ? 3 : d === "medium" ? 1.5 : 0.5, dutyPct: rng.int(2, 18) * 5, dutyTolPct: d === "easy" ? 3 : d === "medium" ? 1.5 : 0.8, bitsMin: Math.max(4, Math.floor(Math.log2(top + 1)) - (d === "easy" ? 3 : d === "medium" ? 1 : 0)) };
  },
  given: (s) => [
    { label: "CPU clock", value: `${s.fcpuMhz} MHz` },
    { label: "Output", value: `${fmt(s.targetHz, 1)} Hz ±${s.tolPct}%` },
    { label: "Duty cycle", value: `${s.dutyPct}% ±${s.dutyTolPct}` },
    { label: "Resolution", value: `at least ${s.bitsMin} bits` },
  ],
  mission: (s) => `Program the timer to output ${fmt(s.targetHz, 1)} Hz (±${s.tolPct}%) at ${s.dutyPct}% duty (±${s.dutyTolPct}) with at least ${s.bitsMin} bits of duty resolution.`,
  controls: () => [
    { kind: "choice", id: "ps", label: "Prescaler", options: choices(PRESCALERS, (v) => `÷${v}`), default: "1" },
    { kind: "choice", id: "top", label: "Counter TOP", options: choices(TOPS), default: "15" },
    { kind: "number", id: "duty", label: "Duty cycle setting", min: 0, max: 100, step: 5, unit: "%", default: 0 },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("freq", `Frequency within ±${s.tolPct}% of ${fmt(s.targetHz, 1)} Hz`, a.errPct <= s.tolPct, `${fmt(a.f, 1)} Hz (${fmt(a.errPct)}% off)`, "Output frequency is the CPU clock divided by prescaler × (TOP + 1). Which two knobs set it?"),
      objective("res", `Duty resolution ≥ ${s.bitsMin} bits`, a.bits >= s.bitsMin, `${fmt(a.bits, 1)} bits (${a.steps} steps)`, "The duty can only change in 1/(TOP + 1) steps. A tiny TOP gives a coarse duty."),
      objective("duty", `Duty within ±${s.dutyTolPct} of ${s.dutyPct}%`, a.dutyErr <= s.dutyTolPct, `${fmt(a.duty, 1)}%`, "Compare value = duty × (TOP + 1), rounded to a whole count."),
    ];
    const period = 100;
    const on = (a.duty / 100) * period;
    const pts: [number, number][] = [];
    for (let k = 0; k < 3; k++) pts.push([k * period, 1], [k * period + on, 1], [k * period + on, 0], [(k + 1) * period, 0]);
    return {
      readings: [info("f", "Output frequency", `${fmt(a.f, 1)} Hz`), gauge("err", "Frequency error", a.errPct, `${fmt(a.errPct)}%`, { min: 0, max: Math.max(s.tolPct * 4, a.errPct * 1.1), high: s.tolPct }), info("cmp", "Compare register", `${a.compare} of ${a.steps}`)],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "PWM output (3 periods)", xLabel: "time (% of period)", yLabel: "pin level", lines: [{ name: "PWM", pts, style: "main" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The timer counts to ${a.top}, so the period is ${a.steps} clock ticks of ${s.fcpuMhz} MHz ÷ ${a.ps}, giving ${fmt(a.f, 1)} Hz. The duty can change in steps of ${fmt(100 / a.steps, 2)}%, and the compare value ${a.compare} produces ${fmt(a.duty, 1)}%. A big prescaler lets a fast clock reach slow outputs; a big TOP gives fine duty control but lowers the frequency.`;
  },
  fallback: (s) => ({
    title: `Drive the fan at ${fmt(s.targetHz, 0)} Hz`,
    story: `A greenhouse controller on a ${s.fcpuMhz} MHz microcontroller must run a fan from a ${fmt(s.targetHz, 1)} Hz PWM signal, finely adjustable around ${s.dutyPct}% duty.`,
  }),
};
export default defineLab(lab);
