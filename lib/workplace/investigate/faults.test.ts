import { describe, expect, it } from "vitest";
import { generateBrightCart } from "../worlds/brightcart";
import { makeRng } from "../rng";
import { detectDuplicateLoad, detectSegmentFault, detectStaleStatus, detectUnitPriceBug, plantDuplicateLoad, plantSegmentFault, plantStaleStatus, plantUnitPriceBug } from "./faults";

const clean = (seed: number) => generateBrightCart(seed);
const Q = { start: "2026-04-01", end: "2026-07-01", label: "Q2 2026" };


describe("segment fault (a slice of the business starts failing)", () => {
  it("is found by detection, with the planted segment as the clear culprit", () => {
    let found = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const planted = plantSegmentFault(clean(seed), makeRng(seed), { window: Q, status: "cancelled", dimensions: ["channel", "city", "segment"] });
      if (!planted) continue;
      const detected = detectSegmentFault(planted.tables, Q, "cancelled");
      expect(detected).not.toBeNull();
      expect(detected!.parts).toEqual(planted.parts);
      expect(detected!.impact).toBe(planted.impact);
      found++;
    }
    expect(found).toBeGreaterThanOrEqual(8);
  });

  it("finds no culprit in clean data, and leaves the input untouched", () => {
    const data = clean(3);
    const before = JSON.stringify(data);
    expect(detectSegmentFault(data, Q, "cancelled")).toBeNull();
    plantSegmentFault(data, makeRng(3), { window: Q, status: "cancelled", dimensions: ["channel"] });
    expect(JSON.stringify(data)).toBe(before);
  });

  it("can hide the fault in a combination of two slices, over a quarter", () => {
    let found = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const planted = plantSegmentFault(clean(seed), makeRng(seed), { window: Q, status: "returned", dimensions: ["channel", "segment"], combine: true });
      if (!planted) continue;
      expect(planted.parts).toHaveLength(2);
      const detected = detectSegmentFault(planted.tables, Q, "returned", true);
      expect(detected?.parts).toEqual(planted.parts);
      found++;
    }
    expect(found).toBeGreaterThanOrEqual(6);
  });
});

describe("duplicate load", () => {
  it("duplicates every order of one day, and detection finds that day and the overstatement", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const planted = plantDuplicateLoad(clean(seed), makeRng(seed));
      expect(planted).not.toBeNull();
      const detected = detectDuplicateLoad(planted!.tables);
      expect(detected).toEqual({ date: planted!.date, overstated: planted!.overstated });
      expect(planted!.overstated).toBeGreaterThan(0);
    }
    expect(detectDuplicateLoad(clean(1))).toBeNull();
  });
});

describe("unit price bug", () => {
  it("makes one product 100 times too dear from some day, and detection names it and the overstatement", () => {
    let found = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const planted = plantUnitPriceBug(clean(seed), makeRng(seed));
      if (!planted) continue;
      const detected = detectUnitPriceBug(planted.tables);
      expect(detected).toEqual({ product: planted.product, overstated: planted.overstated });
      found++;
    }
    expect(found).toBeGreaterThanOrEqual(8);
    expect(detectUnitPriceBug(clean(1))).toBeNull();
  });
});

describe("stale status", () => {
  it("stops marking orders delivered from some day, and detection reports the last delivered day and the stuck revenue", () => {
    let found = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const planted = plantStaleStatus(clean(seed), makeRng(seed));
      if (!planted) continue;
      const detected = detectStaleStatus(planted.tables);
      expect(detected).toEqual({ lastDelivered: planted.lastDelivered, stuckRevenue: planted.stuckRevenue });
      found++;
    }
    expect(found).toBeGreaterThanOrEqual(8);
  });
});
