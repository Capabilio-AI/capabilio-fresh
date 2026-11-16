import { describe, expect, it } from "vitest";
import { generalTargets, generalTotalFor, planFromAvailability, sectionsFor, slotsInPlan } from "./general";

describe("common assessment by year", () => {
  const names = (y: number | null) => sectionsFor(y).map((s) => s.section);
  it("leaves programming out for a 1st year and adds it from 2nd year", () => {
    expect(names(1)).not.toContain("programming_fundamentals");
    expect(names(1)).toEqual(expect.arrayContaining(["quantitative_aptitude", "logical_reasoning", "verbal_communication"]));
    expect(names(2)).toContain("programming_fundamentals");
    expect(names(null)).toContain("programming_fundamentals");
    expect(generalTotalFor(2) - generalTotalFor(1)).toBe(10);
  });
  it("plans and targets only the sections of the plan", () => {
    const plan = planFromAvailability({ quantitative_aptitude: 50, logical_reasoning: 50, verbal_communication: 50, programming_fundamentals: 50 }, 1);
    expect(Object.keys(plan)).not.toContain("programming_fundamentals");
    expect(generalTargets(plan).map((t) => t.id)).not.toContain("programming_fundamentals");
    expect(slotsInPlan(plan).map((g) => g.section)).not.toContain("programming_fundamentals");
  });
});
