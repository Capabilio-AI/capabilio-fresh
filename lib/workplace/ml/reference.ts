import { score, sigmoid, type MlMetric } from "./metrics";
import { isNumeric, type DatasetSpec, type Row } from "./spec";

const ITERATIONS = 700;
const RATE = 0.5;

function encoder(spec: DatasetSpec, train: Row[]) {
  const columns: ((r: Row) => number)[] = [];
  for (const f of spec.features) {
    if (isNumeric(f)) {
      const known = train.map((r) => r.values[f.name] as number).sort((a, b) => a - b);
      const mid = known[Math.floor(known.length / 2)];
      const mean = known.reduce((s, v) => s + v, 0) / known.length;
      const sd = Math.sqrt(known.reduce((s, v) => s + (v - mean) ** 2, 0) / known.length) || 1;
      columns.push((r) => (((r.values[f.name] as number | null) ?? mid) - mean) / sd);
    } else {
      for (const c of f.categories.slice(1)) columns.push((r) => (r.values[f.name] === c.value ? 1 : 0));
    }
  }
  return (r: Row, leak: number) => [...columns.map((col) => col(r)), leak];
}

/**
 * A plain logistic regression standing in for a sensible learner. It is how a ticket proves its target is reachable: if this model, which sees only what
 * the learner sees, cannot reach the pass mark on the actual test rows, the ticket is not served.
 */
export function referencePredict(spec: DatasetSpec, metric: MlMetric, train: Row[], test: Row[], leakTrain: number[] | null, useLeak: boolean): number[] {
  const encode = encoder(spec, train);
  const X = train.map((r, i) => encode(r, useLeak && leakTrain ? leakTrain[i] : 0));
  const y = train.map((r) => r.y);
  const w = new Array(X[0].length + 1).fill(0);
  const p = (x: number[]) => sigmoid(w[0] + x.reduce((s, v, j) => s + v * w[j + 1], 0));
  for (let it = 0; it < ITERATIONS; it++) {
    const grad = new Array(w.length).fill(0);
    X.forEach((x, i) => {
      const e = p(x) - y[i];
      grad[0] += e;
      x.forEach((v, j) => (grad[j + 1] += e * v));
    });
    grad.forEach((g, j) => (w[j] -= (RATE * g) / X.length));
  }
  let cut = 0.5;
  if (metric === "f1") {
    const trainP = X.map(p);
    let best = -1;
    for (let t = 0.05; t < 0.8; t += 0.025) {
      const s = score("f1", y, trainP.map((v) => (v >= t ? 1 : 0)));
      if (s > best) { best = s; cut = t; }
    }
  }
  // in the test file the leaked column is empty, so a model that relied on it sees the neutral value
  return test.map((r) => (p(encode(r, 0)) >= cut ? 1 : 0));
}
