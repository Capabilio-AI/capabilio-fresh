import { describe, expect, it } from "vitest";
import { accentFor, DEFAULT_ACCENT, factLine, inkOn } from "./present";

describe("company page presentation", () => {
  it("falls back to the house accent for anything that is not a 6-digit hex", () => {
    expect(accentFor("#ABCDEF")).toBe("#abcdef");
    for (const bad of [null, undefined, "", "red", "#fff", "#12345", "url(x)", "#12345g"]) expect(accentFor(bad)).toBe(DEFAULT_ACCENT);
  });
  it("picks a readable text colour for light and dark accents", () => {
    expect(inkOn("#ffffff")).toBe("#0c1020");
    expect(inkOn("#ffd400")).toBe("#0c1020");
    expect(inkOn("#000000")).toBe("#ffffff");
    expect(inkOn("#3a45c4")).toBe("#ffffff");
  });
  it("lists only the facts a company filled in, in order", () => {
    expect(factLine({ industry: "Software", sizeBand: "11-50", city: "Pune", foundedYear: 2021 })).toEqual(["Software", "11-50 people", "Pune", "Founded 2021"]);
    expect(factLine({ industry: null, sizeBand: null, city: "Pune", foundedYear: null })).toEqual(["Pune"]);
    expect(factLine({ industry: null, sizeBand: "bogus", city: null, foundedYear: null })).toEqual([]);
  });
});
