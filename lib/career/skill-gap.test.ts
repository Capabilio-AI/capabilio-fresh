import { describe, expect, it } from "vitest";
import { buildCareerMatch, computeSkillGaps } from "./skill-gap";

describe("computeSkillGaps", () => {
  it("returns zero gap when current score meets or exceeds the requirement", () => {
    const gaps = computeSkillGaps(
      { SQL: 70 },
      [{ skill: "SQL", score: 80, confidence: "high" }]
    );
    expect(gaps).toEqual([{ skill: "SQL", required: 70, current: 80, confidence: "high", gap: 0 }]);
  });

  it("computes a positive gap when current score is below the requirement", () => {
    const gaps = computeSkillGaps(
      { SQL: 70 },
      [{ skill: "SQL", score: 20, confidence: "low" }]
    );
    expect(gaps[0].gap).toBe(50);
  });

  it("marks an unassessed skill with null current and confidence 'unassessed'", () => {
    const gaps = computeSkillGaps({ Python: 60 }, []);
    expect(gaps).toEqual([
      { skill: "Python", required: 60, current: null, confidence: "unassessed", gap: 60 },
    ]);
  });
});

describe("buildCareerMatch", () => {
  it("classifies as Ready at or above the 85% readiness threshold", () => {
    const match = buildCareerMatch(
      "Backend Developer",
      { SQL: 50, Python: 50 },
      [
        { skill: "SQL", score: 50, confidence: "high" },
        { skill: "Python", score: 50, confidence: "high" },
      ],
      0
    );
    expect(match.overallReadiness).toBe(100);
    expect(match.recommendation).toBe("Ready");
  });

  it("classifies as Explore between the Explore and Ready thresholds", () => {
    const match = buildCareerMatch(
      "Backend Developer",
      { SQL: 100 },
      [{ skill: "SQL", score: 70, confidence: "medium" }],
      0
    );
    expect(match.overallReadiness).toBe(70);
    expect(match.recommendation).toBe("Explore");
  });

  it("classifies as Long-term pathway below the Explore threshold, even with high interest", () => {
    const match = buildCareerMatch("Data Scientist", { Statistics: 100 }, [], 90);
    expect(match.overallReadiness).toBe(0);
    expect(match.recommendation).toBe("Long-term pathway");
    // High interest does not get silently dropped even though capability is absent.
    expect(match.interestLevel).toBe(90);
  });

  it("never lets readiness exceed 100% even if current scores overshoot every requirement", () => {
    const match = buildCareerMatch(
      "Frontend Developer",
      { CSS: 40 },
      [{ skill: "CSS", score: 100, confidence: "high" }],
      0
    );
    expect(match.overallReadiness).toBe(100);
  });
});
