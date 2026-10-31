import { describe, expect, it } from "vitest";
import { joiningByYear } from "./joining";

describe("joiningByYear", () => {
  it("counts per year and fills the years in between with zero", () => {
    expect(joiningByYear(["2023-07-01T00:00:00Z", "2023-08-01T00:00:00Z", "2025-07-01T00:00:00Z"])).toEqual([
      { year: 2023, joined: 2 }, { year: 2024, joined: 0 }, { year: 2025, joined: 1 },
    ]);
  });
  it("keeps only the latest years", () => {
    const dates = Array.from({ length: 10 }, (_, i) => `${2016 + i}-07-01T00:00:00Z`);
    expect(joiningByYear(dates, 4).map((y) => y.year)).toEqual([2022, 2023, 2024, 2025]);
  });
  it("is empty when nobody joined", () => expect(joiningByYear([])).toEqual([]));
});
