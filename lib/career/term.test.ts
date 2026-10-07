import { describe, expect, it } from "vitest";
import { isLaunchpadOpen, isPlanBTerm } from "./term";

describe("isPlanBTerm", () => {
  it("is true only in 3-1", () => {
    expect(isPlanBTerm(3, 1)).toBe(true);
    expect(isPlanBTerm(3, 2)).toBe(false);
    expect(isPlanBTerm(2, 1)).toBe(false);
    expect(isPlanBTerm(4, 1)).toBe(false);
    expect(isPlanBTerm(null, 1)).toBe(false);
    expect(isPlanBTerm(3, null)).toBe(false);
  });
});

describe("isLaunchpadOpen", () => {
  it("opens in the final year of a 4-year program, not before", () => {
    expect(isLaunchpadOpen(3, 2023, 2027)).toBe(false);
    expect(isLaunchpadOpen(4, 2023, 2027)).toBe(true);
  });
  it("stays closed when years are unknown", () => {
    expect(isLaunchpadOpen(null, 2023, 2027)).toBe(false);
    expect(isLaunchpadOpen(4, null, null)).toBe(false);
  });
});
