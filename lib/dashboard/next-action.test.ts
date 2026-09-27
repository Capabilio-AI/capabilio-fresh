import { describe, expect, it } from "vitest";
import { computeNextAction } from "./next-action";
import type { CareerMatch } from "@/lib/career/skill-gap";

function match(skillGaps: CareerMatch["skillGaps"]): CareerMatch {
  return {
    careerRole: "Backend Developer",
    interestLevel: 0,
    overallReadiness: 50,
    skillGaps,
    recommendation: "Explore",
  };
}

describe("computeNextAction", () => {
  it("returns null when there is no career match", () => {
    expect(computeNextAction(null)).toBeNull();
  });

  it("returns null when every skill gap is already closed", () => {
    const m = match([{ skill: "SQL", required: 50, current: 50, confidence: "high", gap: 0 }]);
    expect(computeNextAction(m)).toBeNull();
  });

  it("picks the single largest gap, not an arbitrary or first one", () => {
    const m = match([
      { skill: "SQL", required: 80, current: 70, confidence: "medium", gap: 10 },
      { skill: "Python", required: 90, current: 10, confidence: "low", gap: 80 },
      { skill: "Statistics", required: 60, current: 30, confidence: "low", gap: 30 },
    ]);
    const action = computeNextAction(m);
    expect(action?.skill).toBe("Python");
    expect(action?.currentLevel).toBe(10);
    expect(action?.targetLevel).toBe(90);
  });

  it("floors the estimated timeline at 2 weeks even for a tiny gap", () => {
    const m = match([{ skill: "SQL", required: 51, current: 50, confidence: "high", gap: 1 }]);
    expect(computeNextAction(m)?.estimatedWeeks).toBe(2);
  });
});
