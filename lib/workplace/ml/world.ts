import type { Rng } from "../rng";
import { score, type MlMetric } from "./metrics";
import { isNumeric, makeRows, type DatasetSpec, type Row, type Value } from "./spec";

export const csv = (header: readonly string[], rows: readonly (readonly (string | number | null)[])[]) =>
  [header.join(","), ...rows.map((r) => r.map((v) => (v === null ? "" : String(v))).join(","))].join("\n");

export interface MlSplit {
  files: { name: string; text: string }[];
  yTest: number[];
  metric: MlMetric;
  baseline: number;
  ceiling: number;
  testRows: number;
  /** server-side only, for checking that a reasonable model can reach the target */
  train: Row[];
  test: Row[];
  /** the label-derived column of each training row (when the task has a leak) */
  leakTrain: number[];
}

const bestThresholdScore = (metric: MlMetric, actual: number[], p: number[]): number => {
  if (metric === "accuracy") return score(metric, actual, p.map((v) => (v >= 0.5 ? 1 : 0)));
  let best = 0;
  for (let t = 0.05; t <= 0.8; t += 0.025) best = Math.max(best, score(metric, actual, p.map((v) => (v >= t ? 1 : 0))));
  return best;
};

/** Accuracy suits balanced outcomes; a rare outcome is scored on F1, because "nobody leaves" would otherwise look good. */
export const metricFor = (spec: DatasetSpec): MlMetric => (spec.target.prevalence >= 0.3 ? "accuracy" : "f1");

/**
 * A train file (features + label) and a test file (features only). Labels of the test rows never leave the server. The ceiling is what a model
 * that knew the true chances would score on those very rows; the baseline is the laziest sensible answer.
 */
export function makeSplit(spec: DatasetSpec, rng: Rng, opts: { leak?: boolean; trainRows?: number; testRows?: number } = {}): MlSplit {
  const trainRows = opts.trainRows ?? 1200;
  const testRows = opts.testRows ?? 500;
  const metric = metricFor(spec);
  const all = makeRows(spec, rng, trainRows + testRows);
  const train = all.slice(0, trainRows);
  const test = all.slice(trainRows);

  const blank = (r: Row): Record<string, Value> => Object.fromEntries(spec.features.map((f) => [f.name, rng.chance(f.missing) ? null : r.values[f.name]]));
  const names = spec.features.map((f) => f.name);
  const leakTrain = opts.leak ? train.map((r) => (r.y ? (rng.chance(0.92) ? 1 : 0) : rng.chance(0.03) ? 1 : 0)) : [];
  const leakName = opts.leak && spec.leak ? [spec.leak.name] : [];

  const trainCells = train.map((r, i) => {
    const v = blank(r);
    return [r.id, ...names.map((n) => v[n]), ...(opts.leak ? [leakTrain[i]] : []), r.y];
  });
  const testCells = test.map((r) => {
    const v = blank(r);
    return [r.id, ...names.map((n) => v[n]), ...(opts.leak ? [null] : [])];
  });

  const yTest = test.map((r) => r.y);
  const majority = train.reduce((s, r) => s + r.y, 0) / train.length >= 0.5 ? 1 : 0;
  const baseline = metric === "f1" ? score("f1", yTest, yTest.map(() => 1)) : score("accuracy", yTest, yTest.map(() => majority));
  return {
    files: [
      { name: "train.csv", text: csv([spec.id_column, ...names, ...leakName, spec.target.name], trainCells) },
      { name: "test.csv", text: csv([spec.id_column, ...names, ...leakName], testCells) },
    ],
    yTest, metric, baseline, ceiling: bestThresholdScore(metric, yTest, test.map((r) => r.p)), testRows, train, test, leakTrain,
  };
}

export const numericFeatures = (spec: DatasetSpec) => spec.features.filter(isNumeric);
