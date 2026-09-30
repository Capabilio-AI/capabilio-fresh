import { describe, expect, it } from "vitest";
import { countByGoal, isGoalKey } from "./career-intent";

describe("career intent helpers", () => {
  it("counts every intent, zeros included", () => {
    expect(countByGoal([{ goal: "job" }, { goal: "job" }, { goal: "higher_studies" }, { goal: "unset" }])).toEqual({
      job: 2,
      higher_studies: 1,
      entrepreneur: 0,
      not_sure: 0,
      unset: 1,
    });
  });
  it("only accepts known goal keys in the URL filter", () => {
    expect(isGoalKey("entrepreneur")).toBe(true);
    expect(isGoalKey("admin")).toBe(false);
    expect(isGoalKey(undefined)).toBe(false);
  });
});
