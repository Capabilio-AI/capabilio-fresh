import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";
import { makeRng } from "@/lib/workplace/rng";

// Computer Architecture: set-associative cache with LRU replacement, run on a generated address trace. AMAT = hit time + miss rate × miss penalty.
interface S { seed: number; pattern: "loop" | "stride" | "hotcold"; footprintKb: number; hitMin: number; amatMaxNs: number; sizeMaxKb: number }

const SIZE = [1, 2, 4, 8, 16, 32, 64];
const WAYS = [1, 2, 4, 8];
const BLOCK = [16, 32, 64, 128];

function trace(s: S): number[] {
  const rng = makeRng(s.seed);
  const out: number[] = [];
  const fp = s.footprintKb * 1024;
  for (let i = 0; i < 3000; i++) {
    if (s.pattern === "loop") out.push((i * 4) % fp);
    else if (s.pattern === "stride") out.push((i * 256) % (fp * 2));
    else out.push(rng.chance(0.8) ? rng.int(0, 2047) * 4 : 8192 + rng.int(0, fp / 4 - 1) * 4);
  }
  return out;
}
function analyse(s: S, st: Settings) {
  const size = Number(st.size) * 1024;
  const ways = Number(st.ways);
  const block = Number(st.block);
  const sets = Math.max(1, Math.floor(size / block / ways));
  const tags: number[][] = Array.from({ length: sets }, () => []);
  let hits = 0;
  const t = trace(s);
  for (const a of t) {
    const b = Math.floor(a / block);
    const set = tags[b % sets];
    const i = set.indexOf(b);
    if (i >= 0) { hits++; set.splice(i, 1); set.push(b); } else { set.push(b); if (set.length > ways) set.shift(); }
  }
  const hitRate = (hits / t.length) * 100;
  const hitTime = 0.5 + 0.12 * Math.log2(Number(st.size)) + 0.1 * Math.log2(ways);
  const penalty = 40 + block / 8;
  return { hitRate, amat: hitTime + (1 - hitRate / 100) * penalty, sizeKb: Number(st.size), sets };
}

const lab: Lab<S> = {
  key: "cache-sim",
  family: "it",
  format: "simulation",
  name: "Cache simulator",
  topic: "Computer Architecture · Cache design and locality",
  keywords: ["computer architecture", "organization", "microprocessor", "operating systems", "embedded", "memory"],
  tools: ["Cache size", "Associativity", "Block size", "Address trace", "AMAT calculator"],
  skillTags: ["Cache hit rate", "Associativity", "Spatial locality"],
  makeScenario(rng, d) {
    const base: S = { seed: rng.int(1, 1_000_000), pattern: rng.pick(["loop", "stride", "hotcold"] as const), footprintKb: rng.pick([2, 4, 6, 8, 12, 16, 24]), hitMin: 0, amatMaxNs: 0, sizeMaxKb: 64 };
    const ref = rng.pick([...gridSettings(lab.controls(base))].filter((st) => Number(st.size) <= 32));
    const a = analyse(base, ref);
    return { ...base, hitMin: Math.floor(a.hitRate * (d === "easy" ? 0.96 : d === "medium" ? 0.99 : 1)), amatMaxNs: Number((a.amat * (d === "easy" ? 1.08 : d === "medium" ? 1.03 : 1.005)).toFixed(2)), sizeMaxKb: Math.max(a.sizeKb, d === "easy" ? a.sizeKb * 2 : a.sizeKb) };
  },
  given: (s) => [{ label: "Program", value: `${s.pattern === "loop" ? "sequential loop" : s.pattern === "stride" ? "256-byte stride sweep" : "80% hot data, 20% cold"} over ${s.footprintKb} KB` }, { label: "Cache budget", value: `at most ${s.sizeMaxKb} KB` }, { label: "Memory penalty", value: "about 40–56 ns per miss" }],
  mission: (s) => `Configure the L1 cache so the program hits at least ${s.hitMin}% of accesses and the average access time stays under ${s.amatMaxNs} ns, using no more than ${s.sizeMaxKb} KB.`,
  controls: () => [
    { kind: "choice", id: "size", label: "Cache size", options: choices(SIZE, (v) => `${v} KB`), default: "1" },
    { kind: "choice", id: "ways", label: "Associativity", options: choices(WAYS, (v) => (v === "1" ? "direct-mapped" : `${v}-way`)), default: "1" },
    { kind: "choice", id: "block", label: "Block size", options: choices(BLOCK, (v) => `${v} B`), default: "16" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("hit", `Hit rate ≥ ${s.hitMin}%`, a.hitRate >= s.hitMin, `${fmt(a.hitRate, 1)}%`, "A cache helps only when the program reuses data it just touched (temporal) or data next to it (spatial). Which does this program do?"),
      objective("amat", `Average access time ≤ ${s.amatMaxNs} ns`, a.amat <= s.amatMaxNs, `${fmt(a.amat, 2)} ns`, "A bigger, more associative cache is slower on every hit. A bigger block lengthens each miss."),
      objective("size", `Size ≤ ${s.sizeMaxKb} KB`, a.sizeKb <= s.sizeMaxKb, `${a.sizeKb} KB`, "SRAM is expensive and takes chip area."),
    ];
    const pts: [number, number][] = SIZE.map((k) => [k, analyse(s, { ...st, size: k }).hitRate]);
    return {
      readings: [info("sets", "Sets", String(a.sets)), gauge("h", "Hit rate", a.hitRate, `${fmt(a.hitRate, 1)}%`, { min: 0, max: 100, low: s.hitMin }), gauge("t", "Access time", a.amat, `${fmt(a.amat, 2)} ns`, { min: 0, max: s.amatMaxNs * 2, high: s.amatMaxNs })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Hit rate against cache size (your other settings)", xLabel: "cache size (KB)", yLabel: "hit rate (%)", lines: [{ name: "Hit rate", pts, style: "main" }, { name: "Target", pts: [[SIZE[0], s.hitMin], [SIZE[SIZE.length - 1], s.hitMin]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The simulated cache served ${fmt(a.hitRate, 1)}% of ${3000} accesses, so the average access cost ${fmt(a.amat, 2)} ns. Hit rate jumps when the cache can hold the program's working set (${s.footprintKb} KB here); beyond that more size only slows hits. Larger blocks exploit spatial locality for sequential code but waste the cache on strided access, and extra associativity removes conflict misses at the cost of a slower lookup.`;
  },
  fallback: (s) => ({ title: `Tune the cache for a ${s.footprintKb} KB workload`, story: `A chip designer must pick the L1 cache of a small processor that will mostly run one ${s.footprintKb} KB loop-heavy program. Silicon area is limited to ${s.sizeMaxKb} KB of cache.` }),
};
export default defineLab(lab);
