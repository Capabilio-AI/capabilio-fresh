import { choices, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// out = G2( G1(A^a, B^b), C^c ) with optional inverters on the three sensors.
interface S { target: number[]; maxInverters: number }

const GATES = ["AND", "OR", "NAND", "NOR", "XOR", "XNOR"] as const;
const apply = (g: string, x: number, y: number): number =>
  g === "AND" ? x & y : g === "OR" ? x | y : g === "NAND" ? 1 - (x & y) : g === "NOR" ? 1 - (x | y) : g === "XOR" ? x ^ y : 1 - (x ^ y);

function table(st: Settings): number[] {
  return Array.from({ length: 8 }, (_, row) => {
    const a = (row >> 2) & 1;
    const b = (row >> 1) & 1;
    const c = row & 1;
    const x = apply(String(st.g1), st.a === "yes" ? 1 - a : a, st.b === "yes" ? 1 - b : b);
    return apply(String(st.g2), x, st.c === "yes" ? 1 - c : c);
  });
}
const inverters = (st: Settings) => ["a", "b", "c"].filter((k) => st[k] === "yes").length;
const bits = (row: number) => `${(row >> 2) & 1}${(row >> 1) & 1}${row & 1}`;

const lab: Lab<S> = {
  key: "logic-gate",
  family: "ece",
  format: "puzzle",
  name: "Logic bench",
  topic: "Digital Electronics · Combinational logic",
  keywords: ["digital", "logic", "boolean", "combinational", "gate"],
  tools: ["Logic gates", "Inverters", "Truth table"],
  skillTags: ["Logic gates", "Boolean algebra", "Truth tables"],
  makeScenario(rng, d) {
    const options = GATES.map(String);
    for (let attempt = 0; attempt < 60; attempt++) {
      const st: Settings = { g1: rng.pick(options), g2: rng.pick(options), a: rng.chance(0.5) ? "yes" : "no", b: rng.chance(0.5) ? "yes" : "no", c: rng.chance(0.5) ? "yes" : "no" };
      const target = table(st);
      const ones = target.reduce((n, v) => n + v, 0);
      if (ones < 2 || ones > 6) continue;
      if (target.every((v, i) => v === table({ g1: "AND", g2: "AND", a: "no", b: "no", c: "no" })[i])) continue;
      let minInv = 3;
      for (const cand of gridSettings(lab.controls({ target, maxInverters: 3 }))) if (table(cand).every((v, i) => v === target[i])) minInv = Math.min(minInv, inverters(cand));
      return { target, maxInverters: d === "easy" ? 3 : d === "medium" ? Math.min(3, minInv + 1) : minInv };
    }
    return { target: [0, 0, 0, 1, 0, 1, 1, 1], maxInverters: 3 };
  },
  given: (s) => [
    { label: "Sensors", value: "A, B, C (1 = triggered)" },
    { label: "Gate must open (output 1) for", value: s.target.flatMap((v, i) => (v ? [bits(i)] : [])).join(", ") + " (ABC)" },
    { label: "Inverters", value: `at most ${s.maxInverters}` },
  ],
  mission: (s) => `Wire three gates so the output is 1 for exactly the required sensor patterns, using at most ${s.maxInverters} inverter${s.maxInverters === 1 ? "" : "s"}.`,
  controls: () => [
    { kind: "choice", id: "g1", label: "First gate (inputs A, B)", options: choices(GATES), default: "AND" },
    { kind: "choice", id: "g2", label: "Second gate (first gate and C)", options: choices(GATES), default: "AND" },
    { kind: "choice", id: "a", label: "Invert sensor A", options: choices(["no", "yes"]), default: "no" },
    { kind: "choice", id: "b", label: "Invert sensor B", options: choices(["no", "yes"]), default: "no" },
    { kind: "choice", id: "c", label: "Invert sensor C", options: choices(["no", "yes"]), default: "no" },
  ],
  evaluate(s, st): Outcome {
    const got = table(st);
    const bad = got.flatMap((v, i) => (v !== s.target[i] ? [i] : []));
    const inv = inverters(st);
    const objectives = [
      objective("table", "Output matches the required table on all 8 rows", bad.length === 0, bad.length === 0 ? "all rows match" : `${bad.length} row${bad.length > 1 ? "s" : ""} differ`, "Compare the Required and Yours columns. In the wrong rows, what do A, B and C have in common?"),
      objective("inv", `At most ${s.maxInverters} inverter${s.maxInverters === 1 ? "" : "s"}`, inv <= s.maxInverters, `${inv} used`, "Every inverter costs a part. Can a different gate do the job of an inverter?"),
    ];
    return {
      readings: [],
      objectives,
      passed: objectives.every((o) => o.ok),
      table: { title: "Truth table", columns: ["A", "B", "C", "Required", "Yours"], rows: got.map((v, i) => [bits(i)[0], bits(i)[1], bits(i)[2], String(s.target[i]), String(v)]), bad },
    };
  },
  explain(s, st) {
    return `Your circuit is ${st.g2}( ${st.g1}( ${st.a === "yes" ? "NOT A" : "A"}, ${st.b === "yes" ? "NOT B" : "B"} ), ${st.c === "yes" ? "NOT C" : "C"} ). Each gate is a small truth table, and wiring them together builds a bigger one. NAND and NOR can stand in for an AND or OR followed by an inverter, and XOR is 1 only when its inputs differ, which is why a different gate choice can save inverters.`;
  },
  fallback: () => ({
    title: "Unlock the security gate",
    story: "A warehouse gate must open only for certain combinations of its three door sensors. The installer has gates and inverters but a short budget for parts. Wire the logic so the gate opens only when it should.",
  }),
};
export default defineLab(lab);
