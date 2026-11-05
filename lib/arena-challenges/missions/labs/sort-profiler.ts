import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";
import { makeRng } from "@/lib/workplace/rng";

// Algorithms: real sorting implementations run on a generated array, counting comparisons and moves.
interface S { seed: number; n: number; shape: "random" | "nearly sorted" | "reversed" | "few distinct" | "sorted"; range: number; opsMax: number; stable: boolean; memoryOk: boolean }

const ALGO = ["bubble sort", "insertion sort", "selection sort", "merge sort", "quicksort (first pivot)", "quicksort (median of 3)", "heap sort", "counting sort"];

function data(s: S): number[] {
  const rng = makeRng(s.seed);
  const a = Array.from({ length: s.n }, () => rng.int(0, s.range - 1));
  if (s.shape === "sorted") a.sort((x, y) => x - y);
  if (s.shape === "reversed") a.sort((x, y) => y - x);
  if (s.shape === "nearly sorted") { a.sort((x, y) => x - y); for (let i = 0; i < Math.max(2, s.n / 50); i++) { const x = rng.int(0, s.n - 1); const y = rng.int(0, s.n - 1); [a[x], a[y]] = [a[y], a[x]]; } }
  if (s.shape === "few distinct") for (let i = 0; i < a.length; i++) a[i] = a[i] % 5;
  return a;
}
function run(algo: string, input: number[]): number {
  const a = [...input];
  let ops = 0;
  const n = a.length;
  const swap = (i: number, j: number) => { [a[i], a[j]] = [a[j], a[i]]; ops++; };
  if (algo === "bubble sort") for (let i = 0; i < n; i++) { let sw = false; for (let j = 0; j < n - 1 - i; j++) { ops++; if (a[j] > a[j + 1]) { swap(j, j + 1); sw = true; } } if (!sw) break; }
  else if (algo === "insertion sort") for (let i = 1; i < n; i++) { const v = a[i]; let j = i - 1; while (j >= 0) { ops++; if (a[j] > v) { a[j + 1] = a[j]; ops++; j--; } else break; } a[j + 1] = v; }
  else if (algo === "selection sort") for (let i = 0; i < n - 1; i++) { let m = i; for (let j = i + 1; j < n; j++) { ops++; if (a[j] < a[m]) m = j; } if (m !== i) swap(i, m); }
  else if (algo === "merge sort") {
    const ms = (lo: number, hi: number) => { if (hi - lo < 2) return; const mid = (lo + hi) >> 1; ms(lo, mid); ms(mid, hi); const t: number[] = []; let i = lo; let j = mid; while (i < mid && j < hi) { ops++; t.push(a[i] <= a[j] ? a[i++] : a[j++]); } while (i < mid) t.push(a[i++]); while (j < hi) t.push(a[j++]); t.forEach((v, k) => { a[lo + k] = v; ops++; }); };
    ms(0, n);
  } else if (algo.startsWith("quicksort")) {
    const med = algo.includes("median");
    const qs = (lo: number, hi: number, depth: number) => { if (lo >= hi || depth > 4000) return; if (med) { const m = (lo + hi) >> 1; if (a[m] < a[lo]) swap(m, lo); if (a[hi] < a[lo]) swap(hi, lo); if (a[hi] < a[m]) swap(hi, m); swap(m, lo); } const p = a[lo]; let i = lo + 1; for (let j = lo + 1; j <= hi; j++) { ops++; if (a[j] < p) { swap(i, j); i++; } } swap(lo, i - 1); qs(lo, i - 2, depth + 1); qs(i, hi, depth + 1); };
    qs(0, n - 1, 0);
  } else if (algo === "heap sort") {
    const sift = (i: number, size: number) => { for (;;) { let m = i; const l = 2 * i + 1; const r = l + 1; if (l < size) { ops++; if (a[l] > a[m]) m = l; } if (r < size) { ops++; if (a[r] > a[m]) m = r; } if (m === i) return; swap(i, m); i = m; } };
    for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n);
    for (let e = n - 1; e > 0; e--) { swap(0, e); sift(0, e); }
  } else { const max = Math.max(...a); ops += n + max + 1 + n; }
  return ops;
}
const props: Record<string, { stable: boolean; extra: boolean }> = { "bubble sort": { stable: true, extra: false }, "insertion sort": { stable: true, extra: false }, "selection sort": { stable: false, extra: false }, "merge sort": { stable: true, extra: true }, "quicksort (first pivot)": { stable: false, extra: false }, "quicksort (median of 3)": { stable: false, extra: false }, "heap sort": { stable: false, extra: false }, "counting sort": { stable: true, extra: true } };
function analyse(s: S, st: Settings) {
  const algo = String(st.algo);
  const input = data(s);
  return { algo, ops: run(algo, input), ...props[algo], counting: algo === "counting sort" };
}

const lab: Lab<S> = {
  key: "sort-profiler",
  family: "it",
  format: "puzzle",
  name: "Algorithm profiler",
  topic: "Design and Analysis of Algorithms · Sorting trade-offs",
  keywords: ["algorithms", "data structures", "design and analysis", "programming", "python", "competitive"],
  tools: ["Algorithm library", "Input generator", "Operation counter"],
  skillTags: ["Time complexity", "Stability", "Best and worst cases"],
  makeScenario(rng, d) {
    const base: S = { seed: rng.int(1, 1_000_000), n: rng.pick([300, 500, 800, 1200, 2000]), shape: rng.pick(["random", "nearly sorted", "reversed", "few distinct", "sorted"] as const), range: rng.pick([50, 1000, 100_000]), opsMax: 0, stable: rng.chance(0.4), memoryOk: rng.chance(0.5) };
    const ok = [...gridSettings(lab.controls(base))].filter((st) => { const p = props[String(st.algo)]; return (!base.stable || p.stable) && (base.memoryOk || !p.extra); });
    const best = Math.min(...ok.map((st) => analyse(base, st).ops));
    return { ...base, opsMax: Math.ceil(best * (d === "easy" ? 3 : d === "medium" ? 1.8 : 1.15)) };
  },
  given: (s) => [{ label: "Input", value: `${s.n} integers in 0–${s.range - 1}, ${s.shape}` }, { label: "Stable", value: s.stable ? "required (equal keys keep their order)" : "not required" }, { label: "Memory", value: s.memoryOk ? "extra O(n) space is fine" : "sort in place (no extra array)" }],
  mission: (s) => `Pick the sorting algorithm that finishes this ${s.shape} input within ${s.opsMax.toLocaleString("en-IN")} operations${s.stable ? ", stably" : ""}${s.memoryOk ? "" : ", in place"}.`,
  controls: () => [{ kind: "choice", id: "algo", label: "Algorithm", options: choices(ALGO), default: "bubble sort" }],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("ops", `Operations ≤ ${s.opsMax.toLocaleString("en-IN")}`, a.ops <= s.opsMax, a.ops.toLocaleString("en-IN"), "Count comparisons and moves: how does each algorithm behave on THIS kind of input (sorted, reversed, few distinct values)?"),
      objective("stable", s.stable ? "Stable" : "Stability not needed", !s.stable || a.stable, a.stable ? "stable" : "not stable", "A stable sort keeps equal items in their original order."),
      objective("mem", s.memoryOk ? "Memory unconstrained" : "In place", s.memoryOk || !a.extra, a.extra ? "uses extra memory" : "in place", "Merge sort and counting sort allocate an extra array."),
      ...(a.counting ? [objective("range", "Counting sort needs a small key range", s.range <= 100_000, `range ${s.range}`, "Counting sort takes time and memory proportional to the key range.")] : []),
    ];
    const pts: [number, number][] = ALGO.map((al, i) => [i + 1, Math.log10(Math.max(1, analyse(s, { algo: al }).ops))]);
    return {
      readings: [gauge("ops", "Operations", a.ops, a.ops.toLocaleString("en-IN"), { min: 0, max: s.opsMax * 3, high: s.opsMax }), info("n", "Input size", String(s.n))],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "log10 operations for each algorithm on this input", xLabel: "algorithm (order of the list)", yLabel: "log10 operations", lines: [{ name: "Operations", pts, style: "main" }, { name: "Budget", pts: [[1, Math.log10(s.opsMax)], [ALGO.length, Math.log10(s.opsMax)]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `${a.algo} took ${a.ops.toLocaleString("en-IN")} operations on this ${s.shape} input of ${s.n} numbers. Bubble and insertion sort are nearly linear on sorted or nearly sorted data and quadratic otherwise; quicksort with a first-element pivot collapses to quadratic on sorted or reversed input, which median-of-three avoids; merge sort and heap sort guarantee O(n log n); counting sort is linear but needs a small key range and extra memory. Complexity is about the input as much as the algorithm.`;
  },
  fallback: (s) => ({ title: `Sort ${s.n} records fast`, story: `A nightly job must sort ${s.n} records that arrive ${s.shape}, and it runs on a machine with strict rules about memory and ordering. The engineer must choose the right algorithm, not just the famous one.` }),
};
export default defineLab(lab);
