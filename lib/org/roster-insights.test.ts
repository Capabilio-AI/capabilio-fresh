import { describe, expect, it } from "vitest";
import { tierDistribution, topRated } from "./roster-insights";

describe("tierDistribution", () => {
  it("counts each tier and the unrated, adding up to the cohort size", () => {
    const d = tierDistribution([300, 450, 700, 1100], 10);
    expect(d.find((t) => t.label === "Rookie")?.count).toBe(2);
    expect(d.find((t) => t.label === "Apprentice")?.count).toBe(1);
    expect(d.find((t) => t.label === "Expert")?.count).toBe(1);
    expect(d.find((t) => t.label === "Not rated yet")?.count).toBe(6);
    expect(d.reduce((n, t) => n + t.count, 0)).toBe(10);
  });
});

describe("topRated", () => {
  const e = (rating: number) => ({ rating, tier: "x", career: null });
  it("orders by rating, then id, and caps the list", () => {
    const m = new Map([["b", e(500)], ["a", e(500)], ["c", e(900)], ["d", e(100)]]);
    expect(topRated(m, 3).map(([id]) => id)).toEqual(["c", "a", "b"]);
  });
});
