import { describe, expect, it } from "vitest";
import { isBulkFlag } from "./roll-number";

describe("isBulkFlag", () => {
  it("lets a few flagged students through", () => {
    expect(isBulkFlag(3, 400)).toBe(false);
    expect(isBulkFlag(20, 1000)).toBe(false);
  });
  it("trips on more than 20 flagged", () => {
    expect(isBulkFlag(21, 1000)).toBe(true);
  });
  it("trips when more than 25% of the college is flagged", () => {
    expect(isBulkFlag(3, 10)).toBe(true);
    expect(isBulkFlag(2, 8)).toBe(false);
  });
  it("does not divide by zero", () => {
    expect(isBulkFlag(0, 0)).toBe(false);
  });
});
