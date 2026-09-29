import { columnValues, numericColumn, type Dataset } from "./dataset";

// ── Math ─────────────────────────────────────────────────────────────────────
export const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function sampleStd(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

export function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

// Two-sided 95% t critical values (df 1–30, then 40/60/120/∞).
const T95: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12, 17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086,
  21: 2.08, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.06, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
};
export function tCritical95(df: number): number {
  if (df <= 30) return T95[df];
  if (df <= 40) return 2.021;
  if (df <= 60) return 2.0;
  if (df <= 120) return 1.98;
  return 1.96;
}

export function ci95Mean(xs: number[]): { lower: number; upper: number } {
  const m = mean(xs);
  const half = tCritical95(xs.length - 1) * (sampleStd(xs) / Math.sqrt(xs.length));
  return { lower: m - half, upper: m + half };
}

/** Abramowitz–Stegun 7.1.26 (|error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

export function twoProportionTest(successA: number, nA: number, successB: number, nB: number): { z: number; pValue: number } {
  const pA = successA / nA;
  const pB = successB / nB;
  const pooled = (successA + successB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  const z = (pB - pA) / se;
  return { z, pValue: 2 * (1 - normalCdf(Math.abs(z))) };
}

// ── Question contract ────────────────────────────────────────────────────────
export type StatQuestion =
  | { id: string; statistic: "mean" | "median" | "sample_std" | "ci95_mean"; column: string }
  | { id: string; statistic: "pearson_r" | "regression"; x_column: string; y_column: string }
  | { id: string; statistic: "two_proportion_test"; group_column: string; outcome_column: string };

export type StatisticKind = StatQuestion["statistic"];

export const STATISTICS_BY_DIFFICULTY: Record<"easy" | "medium" | "hard", StatisticKind[]> = {
  easy: ["mean", "median", "sample_std"],
  medium: ["mean", "median", "sample_std", "pearson_r", "ci95_mean"],
  hard: ["sample_std", "pearson_r", "ci95_mean", "regression", "two_proportion_test"],
};

export type AnswerField =
  | { key: string; label: string; kind: "number"; decimals: number }
  | { key: string; label: string; kind: "choice"; options: string[] };

export interface ExpectedAnswer {
  key: string;
  value: number | string;
  /** Absolute tolerance for numbers — derived from the decimals the question asks for. */
  tolerance?: number;
}

/** Pure. Human-readable question + the fields the candidate fills. Rendered from the parameters, never from AI prose. */
export function describeQuestion(q: StatQuestion): { text: string; fields: AnswerField[] } {
  switch (q.statistic) {
    case "mean":
      return { text: `What is the mean of \`${q.column}\`? (2 decimals)`, fields: [{ key: `${q.id}.value`, label: "Mean", kind: "number", decimals: 2 }] };
    case "median":
      return { text: `What is the median of \`${q.column}\`? (2 decimals)`, fields: [{ key: `${q.id}.value`, label: "Median", kind: "number", decimals: 2 }] };
    case "sample_std":
      return { text: `What is the sample standard deviation (n − 1) of \`${q.column}\`? (2 decimals)`, fields: [{ key: `${q.id}.value`, label: "Sample std dev", kind: "number", decimals: 2 }] };
    case "ci95_mean":
      return {
        text: `Give the 95% confidence interval for the mean of \`${q.column}\`, using the t-distribution with n − 1 degrees of freedom. (2 decimals)`,
        fields: [
          { key: `${q.id}.lower`, label: "Lower bound", kind: "number", decimals: 2 },
          { key: `${q.id}.upper`, label: "Upper bound", kind: "number", decimals: 2 },
        ],
      };
    case "pearson_r":
      return { text: `What is the Pearson correlation coefficient between \`${q.x_column}\` and \`${q.y_column}\`? (3 decimals)`, fields: [{ key: `${q.id}.value`, label: "Pearson r", kind: "number", decimals: 3 }] };
    case "regression":
      return {
        text: `Fit a least-squares line predicting \`${q.y_column}\` from \`${q.x_column}\`. Give the slope and intercept. (3 decimals)`,
        fields: [
          { key: `${q.id}.slope`, label: "Slope", kind: "number", decimals: 3 },
          { key: `${q.id}.intercept`, label: "Intercept", kind: "number", decimals: 3 },
        ],
      };
    case "two_proportion_test":
      return {
        text: `\`${q.outcome_column}\` is 1 for a conversion and 0 otherwise. Run a two-sided two-proportion z-test comparing the two groups in \`${q.group_column}\` (second group minus first, groups in alphabetical order, pooled standard error). Give z and the p-value (3 decimals), and say whether the difference is significant at the 5% level.`,
        fields: [
          { key: `${q.id}.z`, label: "z statistic", kind: "number", decimals: 3 },
          { key: `${q.id}.p`, label: "p-value", kind: "number", decimals: 3 },
          { key: `${q.id}.significant`, label: "Significant at 5%?", kind: "choice", options: ["Yes", "No"] },
        ],
      };
  }
}

// One unit in the last requested decimal: tolerant of intermediate rounding,
// still far tighter than any wrong method would land.
const tol = (decimals: number) => Math.pow(10, -decimals) + 1e-9;

/** Pure. The server-computed key for one question; throws if the data can't support it (generation then retries). */
export function computeExpected(ds: Dataset, q: StatQuestion): ExpectedAnswer[] {
  const needNumbers = (col: string, min: number) => {
    const xs = numericColumn(ds, col);
    if (xs.length < min) throw new Error(`${col} needs at least ${min} numeric values`);
    return xs;
  };
  switch (q.statistic) {
    case "mean":
      return [{ key: `${q.id}.value`, value: mean(needNumbers(q.column, 3)), tolerance: tol(2) }];
    case "median":
      return [{ key: `${q.id}.value`, value: median(needNumbers(q.column, 3)), tolerance: tol(2) }];
    case "sample_std": {
      const s = sampleStd(needNumbers(q.column, 3));
      if (!(s > 0)) throw new Error(`${q.column} has no variation`);
      return [{ key: `${q.id}.value`, value: s, tolerance: tol(2) }];
    }
    case "ci95_mean": {
      const xs = needNumbers(q.column, 5);
      const { lower, upper } = ci95Mean(xs);
      return [
        { key: `${q.id}.lower`, value: lower, tolerance: tol(2) },
        { key: `${q.id}.upper`, value: upper, tolerance: tol(2) },
      ];
    }
    case "pearson_r":
    case "regression": {
      const xAll = columnValues(ds, q.x_column);
      const yAll = columnValues(ds, q.y_column);
      const xs: number[] = [];
      const ys: number[] = [];
      xAll.forEach((x, i) => {
        const y = yAll[i];
        if (typeof x === "number" && typeof y === "number") {
          xs.push(x);
          ys.push(y);
        }
      });
      if (xs.length < 5) throw new Error("needs at least 5 paired numeric rows");
      if (sampleStd(xs) === 0 || sampleStd(ys) === 0) throw new Error("paired columns need variation");
      if (q.statistic === "pearson_r") return [{ key: `${q.id}.value`, value: pearson(xs, ys), tolerance: tol(3) }];
      const { slope, intercept } = linearRegression(xs, ys);
      return [
        { key: `${q.id}.slope`, value: slope, tolerance: tol(3) },
        { key: `${q.id}.intercept`, value: intercept, tolerance: tol(3) },
      ];
    }
    case "two_proportion_test": {
      const groups = columnValues(ds, q.group_column);
      const outcomes = columnValues(ds, q.outcome_column);
      const labels = [...new Set(groups.filter((g): g is string => typeof g === "string"))].sort();
      if (labels.length !== 2) throw new Error(`${q.group_column} must have exactly 2 groups`);
      const tally = labels.map((label) => {
        let n = 0;
        let s = 0;
        groups.forEach((g, i) => {
          if (g !== label) return;
          const o = outcomes[i];
          if (o !== 0 && o !== 1) throw new Error(`${q.outcome_column} must be 0/1`);
          n++;
          s += o;
        });
        return { n, s };
      });
      if (tally.some((t) => t.n < 5)) throw new Error("each group needs at least 5 rows");
      const { z, pValue } = twoProportionTest(tally[0].s, tally[0].n, tally[1].s, tally[1].n);
      if (!Number.isFinite(z)) throw new Error("degenerate proportions");
      return [
        { key: `${q.id}.z`, value: z, tolerance: tol(3) },
        { key: `${q.id}.p`, value: pValue, tolerance: tol(3) },
        { key: `${q.id}.significant`, value: pValue < 0.05 ? "Yes" : "No" },
      ];
    }
  }
}

/** Pure. Grades submitted answers; returns per-field pass/fail only (never the expected values). */
export function gradeAnswers(expected: ExpectedAnswer[], submitted: Record<string, string>): { key: string; passed: boolean }[] {
  return expected.map((e) => {
    const raw = (submitted[e.key] ?? "").trim();
    if (typeof e.value === "string") return { key: e.key, passed: raw.toLowerCase() === e.value.toLowerCase() };
    const n = Number(raw.replace(/,/g, ""));
    return { key: e.key, passed: raw !== "" && Number.isFinite(n) && Math.abs(n - e.value) <= (e.tolerance ?? 1e-9) };
  });
}
