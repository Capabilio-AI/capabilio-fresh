import { describe, expect, it } from "vitest";
import { areaScores, commonSections } from "./common-assessment";

const bars = [
  { section: "quantitative_aptitude", label: "Quantitative Aptitude", score: 62.4, correct: 6, total: 10 },
  { section: "verbal_communication", label: "Communication", score: 40, correct: 4, total: 10 },
  { section: "programming_fundamentals", label: "Basic Programming", score: 80, correct: 8, total: 10 },
  { section: "logical_reasoning", label: "Logical", score: 90, correct: 1, total: 1 },
];

describe("common assessment into readiness", () => {
  it("keeps sections with enough answers and tags the ones that feed an area", () => {
    const s = commonSections(bars);
    expect(s.map((x) => x.section)).toEqual(["quantitative_aptitude", "verbal_communication", "programming_fundamentals"]);
    expect(s.find((x) => x.section === "programming_fundamentals")?.area).toBeNull();
  });
  it("gives a score per readiness area, leaving programming out", () => {
    expect(areaScores({ completedAt: "x", sections: commonSections(bars) })).toEqual({ aptitude: 62, verbal: 40 });
    expect(areaScores(null)).toEqual({});
  });
});
