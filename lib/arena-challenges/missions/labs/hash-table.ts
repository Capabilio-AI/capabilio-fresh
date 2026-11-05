import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";
import { makeRng } from "@/lib/workplace/rng";

// Data Structures: hash table with a chosen hash function and collision strategy, loaded with a generated key set.
interface S { seed: number; n: number; keyKind: "sequential" | "multiples" | "random"; probesMax: number; worstMax: number; memoryMaxKb: number }

const SIZE = [127, 128, 256, 500, 512, 1000, 1024, 2048, 4096, 8192];
const HASH = ["key mod size", "multiplicative (Knuth)", "digit sum"];
const COLL = ["chaining", "linear probing", "double hashing"];

function keys(s: S): number[] {
  const rng = makeRng(s.seed);
  return Array.from({ length: s.n }, (_, i) => (s.keyKind === "sequential" ? 1000 + i : s.keyKind === "multiples" ? 100 * (i + 1) : rng.int(1, 9_999_999)));
}
function h1(k: number, m: number, kind: string): number {
  if (kind === "key mod size") return k % m;
  if (kind === "multiplicative (Knuth)") return Math.floor(m * (((k * 0.6180339887) % 1 + 1) % 1));
  return String(k).split("").reduce((a, c) => a + Number(c), 0) % m;
}
function analyse(s: S, st: Settings) {
  const m = Number(st.size);
  const kind = String(st.hash);
  const coll = String(st.coll);
  const list = keys(s);
  let probes = 0;
  let worst = 0;
  let failed = 0;
  if (coll === "chaining") {
    const chain = new Map<number, number>();
    for (const k of list) { const b = h1(k, m, kind); const len = (chain.get(b) ?? 0) + 1; chain.set(b, len); probes += len; worst = Math.max(worst, len); }
    return { m, avg: probes / list.length, worst, failed, load: s.n / m, memKb: (m * 8 + s.n * 16) / 1024, hist: chain };
  }
  const table = new Array<number>(m).fill(-1);
  for (const k of list) {
    const a = h1(k, m, kind);
    const step = coll === "linear probing" ? 1 : 1 + (k % (m - 1));
    let done = false;
    for (let i = 0; i < m; i++) {
      const idx = (a + i * step) % m;
      probes++;
      if (table[idx] < 0) { table[idx] = k; worst = Math.max(worst, i + 1); done = true; break; }
    }
    if (!done) failed++;
  }
  return { m, avg: probes / list.length, worst, failed, load: s.n / m, memKb: (m * 8) / 1024, hist: new Map<number, number>() };
}

const lab: Lab<S> = {
  key: "hash-table",
  family: "it",
  format: "simulation",
  name: "Data-structure lab",
  topic: "Data Structures · Hashing and collision resolution",
  keywords: ["data structures", "algorithms", "database", "python", "programming", "hashing"],
  tools: ["Table size", "Hash function", "Collision strategy", "Probe counter"],
  skillTags: ["Hash functions", "Load factor", "Collision resolution"],
  makeScenario(rng, d) {
    const base: S = { seed: rng.int(1, 1_000_000), n: rng.pick([200, 400, 600, 800, 1000, 1500]), keyKind: rng.pick(["sequential", "multiples", "random"] as const), probesMax: 0, worstMax: 0, memoryMaxKb: 0 };
    const ref = rng.pick([...gridSettings(lab.controls(base))].filter((st) => analyse(base, st).failed === 0));
    const a = analyse(base, ref);
    return { ...base, probesMax: Number((a.avg * (d === "easy" ? 1.2 : d === "medium" ? 1.05 : 1.005) + 0.02).toFixed(2)), worstMax: Math.ceil(a.worst * (d === "easy" ? 1.3 : d === "medium" ? 1.08 : 1)), memoryMaxKb: Math.ceil(a.memKb * (d === "easy" ? 1.3 : d === "medium" ? 1.08 : 1.01)) };
  },
  given: (s) => [{ label: "Keys", value: `${s.n} ${s.keyKind === "sequential" ? "consecutive IDs" : s.keyKind === "multiples" ? "multiples of 100" : "random IDs"}` }, { label: "Memory", value: `at most ${s.memoryMaxKb} KB (8 B per slot, 16 B per chained node)` }],
  mission: (s) => `Build the hash table so the average lookup takes ≤ ${s.probesMax} probes, the worst ≤ ${s.worstMax}, no key fails to insert, and memory stays under ${s.memoryMaxKb} KB.`,
  controls: () => [
    { kind: "choice", id: "size", label: "Table size", options: choices(SIZE), default: "127" },
    { kind: "choice", id: "hash", label: "Hash function", options: choices(HASH), default: "key mod size" },
    { kind: "choice", id: "coll", label: "Collision strategy", options: choices(COLL), default: "chaining" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("avg", `Average probes ≤ ${s.probesMax}`, a.avg <= s.probesMax, fmt(a.avg, 2), "Collisions lengthen every lookup. A good hash spreads keys evenly and a lower load factor means fewer collisions."),
      objective("worst", `Worst probe length ≤ ${s.worstMax}`, a.worst <= s.worstMax, String(a.worst), "A bad hash function piles keys into the same spot. Look at what the keys have in common."),
      objective("fail", "Every key inserted", a.failed === 0, a.failed ? `${a.failed} keys failed` : "all inserted", "Open addressing cannot hold more keys than slots; probing must also be able to reach every slot."),
      objective("mem", `Memory ≤ ${s.memoryMaxKb} KB`, a.memKb <= s.memoryMaxKb, `${fmt(a.memKb, 1)} KB`, "A bigger table lowers collisions but costs memory."),
    ];
    const pts: [number, number][] = SIZE.map((sz) => [sz, analyse(s, { ...st, size: sz }).avg]);
    return {
      readings: [info("lf", "Load factor", fmt(a.load, 2)), gauge("avg", "Average probes", a.avg, fmt(a.avg, 2), { min: 1, max: Math.max(s.probesMax * 3, 5), high: s.probesMax }), gauge("mem", "Memory", a.memKb, `${fmt(a.memKb, 1)} KB`, { min: 0, max: s.memoryMaxKb * 2, high: s.memoryMaxKb })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Average probes against table size", xLabel: "table size", yLabel: "average probes", lines: [{ name: "Probes", pts, style: "main" }, { name: "Limit", pts: [[SIZE[0], s.probesMax], [SIZE[SIZE.length - 1], s.probesMax]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `With a load factor of ${fmt(a.load, 2)} the table needs ${fmt(a.avg, 2)} probes on average and ${a.worst} in the worst case. A modulus that shares a factor with the keys (such as 100 with size 500 or 1000) sends them to a handful of slots, which is why table sizes are usually prime or the hash mixes the bits. Chaining degrades gracefully above load factor 1, while open addressing fails once the table is full and clusters badly under linear probing.`;
  },
  fallback: (s) => ({ title: `Index ${s.n} customer IDs`, story: `A start-up needs constant-time lookup of ${s.n} customer IDs in a tiny service that has only ${s.memoryMaxKb} KB to spare. The engineer chooses the table size, hash function and collision method.` }),
};
export default defineLab(lab);
