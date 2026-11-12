import { describe, expect, it } from "vitest";
import { ARENA_DIFFICULTY_SCALE, crossedMilestone, extraEvidenceId } from "./arena-rules";

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

describe("extraEvidenceId", () => {
  const attempt = "8c13b11d-75d1-4d82-8c28-13fdfe92b179";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  it("is a valid uuid the evidence table accepts, stable per attempt and skill, and different per skill", () => {
    const a = extraEvidenceId(attempt, "skill-a");
    expect(a).toMatch(UUID);
    expect(extraEvidenceId(attempt, "skill-a")).toBe(a);
    expect(extraEvidenceId(attempt, "skill-b")).not.toBe(a);
    expect(extraEvidenceId("another-attempt", "skill-a")).not.toBe(a);
  });
});
