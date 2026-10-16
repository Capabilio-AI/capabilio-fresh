export type MlMetric = "accuracy" | "f1";

export interface Confusion {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export function confusion(actual: readonly number[], predicted: readonly number[]): Confusion {
  const c = { tp: 0, fp: 0, fn: 0, tn: 0 };
  actual.forEach((a, i) => {
    const p = predicted[i];
    if (a === 1) p === 1 ? c.tp++ : c.fn++;
    else p === 1 ? c.fp++ : c.tn++;
  });
  return c;
}

const ratio = (num: number, den: number) => (den === 0 ? 0 : num / den);
export const precision = (c: Confusion) => ratio(c.tp, c.tp + c.fp);
export const recall = (c: Confusion) => ratio(c.tp, c.tp + c.fn);
export const accuracy = (c: Confusion) => ratio(c.tp + c.tn, c.tp + c.fp + c.fn + c.tn);
export const f1 = (c: Confusion) => ratio(2 * c.tp, 2 * c.tp + c.fp + c.fn);

export function score(metric: MlMetric, actual: readonly number[], predicted: readonly number[]): number {
  const c = confusion(actual, predicted);
  return metric === "f1" ? f1(c) : accuracy(c);
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
