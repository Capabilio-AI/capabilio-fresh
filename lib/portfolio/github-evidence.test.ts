import { describe, expect, it } from "vitest";
import { aggregateLanguages } from "./github-evidence";
import { heatLevel } from "@/components/vault/ContributionHeatmap";

describe("aggregateLanguages", () => {
  it("weights languages by repository size", () => {
    const result = aggregateLanguages([
      { sizeKb: 9000, languages: [{ name: "TypeScript", percentage: 100 }] },
      { sizeKb: 1000, languages: [{ name: "Python", percentage: 100 }] },
    ]);
    expect(result).toEqual([
      { name: "TypeScript", percentage: 90 },
      { name: "Python", percentage: 10 },
    ]);
  });

  it("returns nothing when no repository has language data", () => {
    expect(aggregateLanguages([{ sizeKb: 100, languages: [] }])).toEqual([]);
  });
});

describe("heatLevel", () => {
  it("is 0 for no activity and scales to the busiest day", () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(10, 10)).toBe(4);
  });
});
