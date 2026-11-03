import { describe, expect, it } from "vitest";
import { factLine } from "./present";

describe("company page presentation", () => {
  it("lists only the facts a company filled in, in order", () => {
    expect(factLine({ industry: "Software", sizeBand: "11-50", city: "Pune", foundedYear: 2021 })).toEqual(["Software", "11-50 people", "Pune", "Founded 2021"]);
    expect(factLine({ industry: null, sizeBand: null, city: "Pune", foundedYear: null })).toEqual(["Pune"]);
    expect(factLine({ industry: null, sizeBand: "bogus", city: null, foundedYear: null })).toEqual([]);
  });
});
