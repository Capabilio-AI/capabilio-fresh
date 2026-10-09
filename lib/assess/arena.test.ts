import { describe, expect, it } from "vitest";
import { ARENA_DIFFICULTY_SCALE, crossedMilestone } from "./arena-rules";

describe("crossedMilestone", () => {
  it("fires only when a pass carries the rating across a multiple of 50", () => {
    expect(crossedMilestone(446, 450)).toBe(true);
    expect(crossedMilestone(404, 408)).toBe(false);
    expect(crossedMilestone(449, 449)).toBe(false);
    expect(crossedMilestone(398, 404)).toBe(true);
  });
  it("harder challenges are worth more", () => {
    expect(ARENA_DIFFICULTY_SCALE.hard).toBeGreaterThan(ARENA_DIFFICULTY_SCALE.medium);
    expect(ARENA_DIFFICULTY_SCALE.medium).toBeGreaterThan(ARENA_DIFFICULTY_SCALE.easy);
  });
});
