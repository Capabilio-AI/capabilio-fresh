import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Ohm's law and KVL around a series LED string.
interface S { vs: number; vf: number; count: number; imin: number; imax: number; pRating: number; colour: string }

const RES = [47, 56, 68, 82, 100, 120, 150, 180, 220, 270, 330, 390, 470, 560, 680, 820, 1000, 1200, 1500, 1800, 2200, 3300, 4700, 10000];

function analyse(s: S, st: Settings) {
  const n = Number(st.n);
  const r = Number(st.r);
  const headroom = s.vs - n * s.vf;
  const i = headroom > 0 ? headroom / r : 0;
  return { n, r, headroom, i, iMa: i * 1000, p: i * i * r };
}

const lab: Lab<S> = {
  key: "led-string",
  family: "ece",
  format: "simulation",
  name: "Circuit bench",
  topic: "Basic Electrical and Electronics · Ohm's law and KVL",
  keywords: ["circuit", "basic electrical", "network", "ohm", "kirchhoff", "electronics"],
  tools: ["DC supply", "Resistors", "LEDs", "Ammeter"],
  skillTags: ["Ohm's law", "KVL", "Series circuits"],
  makeScenario(rng, d) {
    const colour = rng.pick([["red", 1.9], ["green", 2.1], ["white", 3.0]] as const);
    const vf = colour[1];
    const vs = rng.pick([5, 9, 12]);
    const maxN = Math.max(1, Math.min(3, Math.floor((vs - 1) / vf)));
    return { vs, vf, count: rng.int(1, maxN), imin: d === "hard" ? 15 : 8, imax: 20, pRating: d === "hard" ? 0.125 : 0.25, colour: colour[0] };
  },
  given: (s) => [
    { label: "Supply", value: `${s.vs} V DC` },
    { label: "LED", value: `${s.colour}, ${fmt(s.vf, 1)} V forward drop, ${s.imin}–${s.imax} mA` },
    { label: "Resistor power rating", value: `${s.pRating} W` },
  ],
  mission: (s) => `Light exactly ${s.count} ${s.colour} LED${s.count > 1 ? "s in series" : ""} at ${s.imin}–${s.imax} mA without overloading the resistor.`,
  controls: () => [
    { kind: "choice", id: "n", label: "LEDs in series", options: choices([1, 2, 3]), default: "1" },
    { kind: "choice", id: "r", label: "Series resistor", options: choices(RES, (v) => (Number(v) >= 1000 ? `${Number(v) / 1000} kΩ` : `${v} Ω`)), default: "47" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("count", `Exactly ${s.count} LED${s.count > 1 ? "s" : ""} in the string`, a.n === s.count, `${a.n} in series`, "How many LEDs does the mission ask you to light?"),
      objective("on", `Current ≥ ${s.imin} mA (bright enough)`, a.iMa >= s.imin, `${fmt(a.iMa, 1)} mA`, "The resistor sees only what is left of the supply after the LEDs take their drops. Apply KVL around the loop."),
      objective("safe", `Current ≤ ${s.imax} mA (LED survives)`, a.iMa <= s.imax, `${fmt(a.iMa, 1)} mA`, "A small resistor lets the current rise until the LED burns. Work out the resistance that gives the current you want."),
      objective("power", `Resistor dissipation ≤ ${s.pRating} W`, a.p <= s.pRating, `${fmt(a.p * 1000, 0)} mW`, "Power in a resistor is I²R. Is the resistor getting hot?"),
    ];
    return {
      readings: [
        gauge("i", "LED current", a.iMa, `${fmt(a.iMa, 1)} mA`, { min: 0, max: s.imax * 2.5, low: s.imin, high: s.imax }),
        gauge("p", "Resistor power", a.p * 1000, `${fmt(a.p * 1000, 0)} mW`, { min: 0, max: s.pRating * 2000, high: s.pRating * 1000 }),
        info("v", "Voltage left for the resistor", `${fmt(Math.max(0, a.headroom), 2)} V`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `Kirchhoff's voltage law around the loop: ${s.vs} V = ${a.n} × ${fmt(s.vf, 1)} V (LED drops) + I × R. So the resistor sees ${fmt(Math.max(0, a.headroom))} V, and I = V/R = ${fmt(a.iMa, 1)} mA with ${a.r} Ω. The resistor turns I²R = ${fmt(a.p * 1000, 0)} mW into heat, so its power rating matters as much as its resistance. A good value sits near R = (Vs − n·Vf)/I_target.`;
  },
  fallback: (s) => ({
    title: `Light the ${s.colour} indicator${s.count > 1 ? "s" : ""} safely`,
    story: `An electrician is building a panel indicator and has a ${s.vs} V supply, a box of resistors and a few ${s.colour} LEDs. The last panel she built burned out its LEDs within a day. Set up the circuit so the indicators stay bright and survive.`,
  }),
};
export default defineLab(lab);
