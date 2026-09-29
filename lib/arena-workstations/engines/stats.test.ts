import { describe, expect, it } from "vitest";
import { ci95Mean, computeExpected, gradeAnswers, linearRegression, mean, median, normalCdf, pearson, sampleStd, twoProportionTest } from "./stats";
import type { Dataset } from "./dataset";

describe("statistics math (reference values)", () => {
  const xs = [2, 4, 4, 4, 5, 5, 7, 9];
  it("computes descriptive statistics", () => {
    expect(mean(xs)).toBe(5);
    expect(median(xs)).toBe(4.5);
    expect(sampleStd(xs)).toBeCloseTo(2.13809, 4);
  });
  it("computes correlation and regression", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 5, 4, 5];
    expect(pearson(x, y)).toBeCloseTo(0.774597, 5);
    const { slope, intercept } = linearRegression(x, y);
    expect(slope).toBeCloseTo(0.6, 9);
    expect(intercept).toBeCloseTo(2.2, 9);
  });
  it("computes a t-based confidence interval", () => {
    const { lower, upper } = ci95Mean([10, 12, 14, 16, 18]);
    // mean 14, s = 3.1623, t(4) = 2.776 → half-width 3.926
    expect(lower).toBeCloseTo(10.074, 2);
    expect(upper).toBeCloseTo(17.926, 2);
  });
  it("computes the normal CDF and a two-proportion test", () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    const { z, pValue } = twoProportionTest(40, 200, 60, 200);
    expect(z).toBeCloseTo(2.3094, 3);
    expect(pValue).toBeCloseTo(0.0209, 3);
  });
});

describe("statistics contract", () => {
  const ds: Dataset = {
    name: "sessions",
    columns: [
      { name: "variant", type: "text" },
      { name: "converted", type: "number" },
      { name: "minutes", type: "number" },
    ],
    rows: [
      ["A", 0, 3], ["A", 1, 5], ["A", 0, 2], ["A", 0, 4], ["A", 1, 6],
      ["B", 1, 7], ["B", 1, 6], ["B", 0, 3], ["B", 1, 8], ["B", 1, 9],
    ],
  };

  it("computes keys server-side and grades within the stated precision", () => {
    const expected = computeExpected(ds, { id: "q1", statistic: "mean", column: "minutes" });
    expect(expected[0].value).toBe(5.3);
    expect(gradeAnswers(expected, { "q1.value": "5.30" })[0].passed).toBe(true);
    expect(gradeAnswers(expected, { "q1.value": "5.31" })[0].passed).toBe(true);
    expect(gradeAnswers(expected, { "q1.value": "5.32" })[0].passed).toBe(false);
    expect(gradeAnswers(expected, { "q1.value": "" })[0].passed).toBe(false);
  });

  it("grades a significance decision", () => {
    const expected = computeExpected(ds, { id: "t", statistic: "two_proportion_test", group_column: "variant", outcome_column: "converted" });
    const sig = expected.find((e) => e.key === "t.significant")!;
    expect(gradeAnswers([sig], { "t.significant": String(sig.value) })[0].passed).toBe(true);
  });

  it("refuses parameters the data can't support", () => {
    expect(() => computeExpected(ds, { id: "x", statistic: "mean", column: "nope" })).toThrow();
    expect(() => computeExpected(ds, { id: "x", statistic: "two_proportion_test", group_column: "minutes", outcome_column: "converted" })).toThrow();
  });
});
