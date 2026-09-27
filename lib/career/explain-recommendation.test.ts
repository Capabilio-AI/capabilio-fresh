import { describe, expect, it } from "vitest";
import { explainRecommendation } from "./explain-recommendation";
import type { CareerMatch } from "./skill-gap";

function match(careerRole: string, skillGaps: CareerMatch["skillGaps"], overallReadiness = 50, interestLevel = 0): CareerMatch {
  return { careerRole, interestLevel, overallReadiness, skillGaps, recommendation: "Explore" };
}

describe("explainRecommendation", () => {
  it("detects an exact (case-insensitive) match with the stated interest", () => {
    const result = explainRecommendation(match("Business Analyst", []), "business analyst");
    expect(result.matchesStatedInterest).toBe(true);
  });

  it("flags a mismatch when the stated interest differs from the recommendation", () => {
    const result = explainRecommendation(match("Business Analyst", []), "SAP");
    expect(result.matchesStatedInterest).toBe(false);
  });

  it("surfaces real closed-gap skills as the strongest-skills list, capped at 3", () => {
    const result = explainRecommendation(
      match("Business Analyst", [
        { skill: "SQL", required: 60, current: 70, confidence: "high", gap: 0 },
        { skill: "Excel", required: 50, current: 50, confidence: "high", gap: 0 },
        { skill: "Communication", required: 60, current: 80, confidence: "high", gap: 0 },
        { skill: "Statistics", required: 60, current: 60, confidence: "medium", gap: 0 },
      ]),
      "SAP"
    );
    expect(result.reasonKind).toBe("skills");
    expect(result.strongestSkills).toEqual(["SQL", "Excel", "Communication"]);
    expect(result.closestGapSkill).toBeNull();
  });

  it("falls back to the closest gap skill when readiness is non-zero but nothing is fully closed", () => {
    const result = explainRecommendation(
      match(
        "Business Analyst",
        [
          { skill: "SQL", required: 60, current: 40, confidence: "medium", gap: 20 },
          { skill: "Excel", required: 50, current: 10, confidence: "low", gap: 40 },
        ],
        35
      ),
      "SAP"
    );
    expect(result.reasonKind).toBe("closest-gap");
    expect(result.strongestSkills).toEqual([]);
    expect(result.closestGapSkill).toBe("SQL");
  });

  it("reports the real interest signal, not a fabricated skill reason, when readiness is genuinely zero (the common real-account case: fine-grained assessment skill names don't exact-match coarse career_requirements keys)", () => {
    const result = explainRecommendation(
      match(
        "Business Analyst",
        [
          { skill: "SQL", required: 60, current: null, confidence: "unassessed", gap: 60 },
          { skill: "Communication", required: 85, current: null, confidence: "unassessed", gap: 85 },
        ],
        0,
        70
      ),
      "Sap"
    );
    expect(result.reasonKind).toBe("interest");
    expect(result.interestLevel).toBe(70);
    expect(result.closestGapSkill).toBeNull();
  });

  it("reports 'none' when there is truly no positive signal at all", () => {
    const result = explainRecommendation(
      match("Business Analyst", [{ skill: "SQL", required: 60, current: null, confidence: "unassessed", gap: 60 }], 0, 0),
      "Sap"
    );
    expect(result.reasonKind).toBe("none");
  });
});
