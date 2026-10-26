import type { CalcTemplate } from "./types";
import { relTol } from "./types";

/** Test-only template: never served. Ohm's law on a seeded resistor. */
export const EXAMPLE_CALC_TEMPLATES: CalcTemplate[] = [
  {
    id: "example-ohm",
    areas: ["example-area"],
    difficulty: "easy",
    minLevel: "fresher",
    build(rng) {
      const v = rng.int(5, 24);
      const r = rng.int(2, 9) * 100;
      const i = (v / r) * 1000;
      const p = (v * v) / r;
      return {
        title: "Resistor load check",
        requester: { name: "Test Requester", title: "Test Lead" },
        scenario: "A resistor is fed from a fixed supply. Find the current and the power it dissipates.",
        params: [
          { label: "Supply voltage", value: String(v), unit: "V" },
          { label: "Resistance", value: String(r), unit: "ohm" },
        ],
        fields: [
          { key: "current", label: "Current", unit: "mA" },
          { key: "power", label: "Power", unit: "W" },
        ],
        key: { expected: { current: i, power: p }, tolerance: { current: relTol(i), power: relTol(p) } },
        reference: ["I = V / R", "P = V^2 / R"],
      };
    },
  },
];
