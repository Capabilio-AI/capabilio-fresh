import type { CalcTemplate } from "./types";
import { relTol } from "./types";

const AREA = "emb-circuit-calcs";
const CAST = { name: "Rohit Menon", title: "Hardware Lead" };
const round = (x: number, d = 3) => Number(x.toFixed(d));

/** Embedded Systems circuit calculations: the arithmetic a firmware engineer checks before touching the board. The student enters bare numbers. */
export const EMBEDDED_CALC_TEMPLATES: CalcTemplate[] = [
  {
    id: "emb-led-resistor",
    areas: [AREA],
    difficulty: "easy",
    minLevel: "fresher",
    build(rng) {
      const [name, vf] = rng.pick([["red", 2.0], ["green", 2.2], ["yellow", 2.1]] as const);
      const vs = rng.pick([3.3, 5]);
      const ifMa = rng.pick([5, 10, 15, 20]);
      const r = ((vs - vf) / ifMa) * 1000;
      const p = (vs - vf) * ifMa;
      return {
        title: `Pick the series resistor for a ${name} status LED`,
        requester: CAST,
        scenario: `The status LED on the new node is driven straight from a GPIO pin that sits at the supply voltage when high. I need the series resistor value and the power it dissipates.`,
        params: [
          { label: "Supply (pin high)", value: String(vs), unit: "V" },
          { label: `${name} LED forward voltage`, value: String(vf), unit: "V" },
          { label: "Target LED current", value: String(ifMa), unit: "mA" },
        ],
        fields: [
          { key: "resistor", label: "Series resistor", unit: "ohm" },
          { key: "power", label: "Resistor power", unit: "mW" },
        ],
        key: { expected: { resistor: round(r), power: round(p) }, tolerance: { resistor: relTol(r), power: relTol(p) } },
        reference: ["R = (Vsupply - Vf) / If", "P = (Vsupply - Vf) x If"],
      };
    },
  },
  {
    id: "emb-voltage-divider",
    areas: [AREA],
    difficulty: "easy",
    minLevel: "fresher",
    build(rng) {
      const vin = rng.pick([5, 9, 12]);
      const r1 = rng.pick([10, 22, 47]);
      const r2 = rng.pick([10, 15, 33]);
      const vout = (vin * r2) / (r1 + r2);
      const i = vin / (r1 + r2);
      return {
        title: "Check the battery-sense voltage divider",
        requester: CAST,
        scenario: "A resistor divider scales the battery voltage down for one ADC pin. Work out the voltage the pin sees and the current the divider draws from the battery.",
        params: [
          { label: "Battery voltage", value: String(vin), unit: "V" },
          { label: "R1 (top)", value: String(r1), unit: "kohm" },
          { label: "R2 (bottom, to ground)", value: String(r2), unit: "kohm" },
        ],
        fields: [
          { key: "vout", label: "Voltage at the ADC pin", unit: "V" },
          { key: "current", label: "Divider current", unit: "mA" },
        ],
        key: { expected: { vout: round(vout), current: round(i, 4) }, tolerance: { vout: relTol(vout), current: relTol(i) } },
        reference: ["Vout = Vin x R2 / (R1 + R2)", "I = Vin / (R1 + R2)", "kohm and volts give mA"],
      };
    },
  },
  {
    id: "emb-adc-resolution",
    areas: [AREA],
    difficulty: "easy",
    minLevel: "fresher",
    build(rng) {
      const bitsN = rng.pick([10, 12]);
      const vref = rng.pick([3.3, 5]);
      const vin = round(rng.int(5, 95) * vref / 100, 2);
      const lsb = (vref * 1000) / 2 ** bitsN;
      const code = Math.floor((vin / vref) * 2 ** bitsN);
      return {
        title: "Size the ADC step and the expected reading",
        requester: CAST,
        scenario: "Before wiring the analogue input I want to know how fine the ADC is and what count the firmware should see for a known voltage on the pin.",
        params: [
          { label: "ADC resolution", value: String(bitsN), unit: "bit" },
          { label: "Reference voltage", value: String(vref), unit: "V" },
          { label: "Input voltage", value: String(vin), unit: "V" },
        ],
        fields: [
          { key: "lsb", label: "Voltage of one count (1 LSB)", unit: "mV" },
          { key: "code", label: "ADC count for the input (rounded down)", unit: "counts" },
        ],
        key: { expected: { lsb: round(lsb), code }, tolerance: { lsb: relTol(lsb), code: 1 } },
        reference: ["counts = 2^bits", "1 LSB = Vref / 2^bits", "count = floor(Vin / Vref x 2^bits)"],
      };
    },
  },
  {
    id: "emb-rc-time-constant",
    areas: [AREA],
    difficulty: "medium",
    minLevel: "fresher",
    build(rng) {
      const r = rng.pick([4.7, 10, 22, 47, 100]);
      const c = rng.pick([1, 2.2, 4.7, 10]);
      const tau = r * c;
      const t90 = tau * Math.log(10);
      return {
        title: "How long does the reset line take to settle?",
        requester: CAST,
        scenario: "The reset line is held low by a capacitor that charges through a resistor after power-up. I need the time constant and how long the line takes to reach 90% of the supply.",
        params: [
          { label: "Resistor", value: String(r), unit: "kohm" },
          { label: "Capacitor", value: String(c), unit: "uF" },
        ],
        fields: [
          { key: "tau", label: "Time constant", unit: "ms" },
          { key: "t90", label: "Time to reach 90% of the supply", unit: "ms" },
        ],
        key: { expected: { tau: round(tau), t90: round(t90) }, tolerance: { tau: relTol(tau), t90: relTol(t90) } },
        reference: ["tau = R x C (kohm x uF = ms)", "v(t) = Vs x (1 - e^(-t/tau))", "t90 = tau x ln(10)"],
      };
    },
  },
  {
    id: "emb-divider-design",
    areas: [AREA],
    difficulty: "medium",
    minLevel: "fresher",
    build(rng) {
      const vin = rng.pick([5, 9, 12]);
      const vt = rng.pick([1.8, 2.5, 3.3].filter((v) => v < vin * 0.8));
      const r1 = rng.pick([10, 22, 47]);
      const r2 = (r1 * vt) / (vin - vt);
      const i = vin / (r1 + r2);
      return {
        title: "Choose the bottom resistor of a sense divider",
        requester: CAST,
        scenario: "A 3.3 V-tolerant ADC pin must see a target voltage when the sensor supply is at its full value. R1 is already on the board; pick R2 and tell me the current the divider will draw.",
        params: [
          { label: "Sensor supply", value: String(vin), unit: "V" },
          { label: "R1 (top, fitted)", value: String(r1), unit: "kohm" },
          { label: "Target voltage at the pin", value: String(vt), unit: "V" },
        ],
        fields: [
          { key: "r2", label: "R2 (bottom, to ground)", unit: "kohm" },
          { key: "current", label: "Divider current", unit: "mA" },
        ],
        key: { expected: { r2: round(r2), current: round(i, 4) }, tolerance: { r2: relTol(r2), current: relTol(i) } },
        reference: ["Vout = Vin x R2 / (R1 + R2)", "R2 = R1 x Vout / (Vin - Vout)", "I = Vin / (R1 + R2)"],
      };
    },
  },
];
