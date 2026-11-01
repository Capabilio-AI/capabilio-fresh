import { describe, expect, it } from "vitest";
import { histogram, summarise } from "./stats-explore";

describe("histogram", () => {
  it("puts every value in exactly one bin, including the maximum", () => {
    const xs = [1, 2, 2, 3, 3, 3, 9, 10];
    const bins = histogram(xs);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(xs.length);
    expect(bins.at(-1)!.count).toBeGreaterThan(0);
  });
  it("handles an empty or constant column without dividing by zero", () => {
    expect(histogram([])).toEqual([]);
    expect(histogram([5, 5, 5])).toEqual([{ label: "5", from: 5, to: 5, count: 3 }]);
  });
});

describe("summarise", () => {
  it("counts gaps and reports the range, and nothing that gives the answer away", () => {
    const s = summarise([4, 9, null, "", 2]);
    expect(s).toEqual({ n: 3, missing: 2, min: 2, max: 9 });
    expect(Object.keys(s)).not.toContain("mean");
  });
});
