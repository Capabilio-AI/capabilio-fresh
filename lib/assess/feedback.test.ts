import { describe, expect, it } from "vitest";
import { FeedbackSchema, feedbackToneOk } from "@/lib/ai/llm/prompts/feedback.v1";
import { templateCareer, templateCommon } from "./feedback";
import type { SectionBar, SkillResult } from "./scoring";
import type { AssessmentResult } from "./types";

const skill = (name: string, score: number | null): SkillResult => ({ skillId: name, key: name, name, category: "Data", importance: "HIGH", targetLevel: 70, weight: 3, score, confidence: score === null ? "INSUFFICIENT" : "MEDIUM", evidenceCount: score === null ? 0 : 2 });
const bars: SectionBar[] = [
  { section: "verbal_communication", label: "Communication", score: 82, confidence: "HIGH", correct: 8, total: 10 },
  { section: "programming_fundamentals", label: "Basic Programming", score: 41, confidence: "HIGH", correct: 4, total: 10 },
];
const result = {
  layer: "CAREER", completedAt: "", career: { id: "c", key: "data-analyst", name: "Data Analyst" }, elo: { startingElo: 400, answered: 22, correct: 17, incorrect: 5, gained: 68, lost: 10, net: 58, newElo: 458 },
  readiness: 63, coverage: 90, skills: [], strongest: [skill("SQL", 88)], focusAreas: [skill("Power BI", 40)], notYetMeasured: [skill("Statistics", null)], nextBestAction: null, general: bars,
} as AssessmentResult;

describe("template feedback (the never-blank fallback)", () => {
  it("covers both parts, passes its own schema and tone gate, and mentions real facts", () => {
    for (const f of [templateCommon(bars), templateCareer(result)]) {
      expect(FeedbackSchema.safeParse(f).success).toBe(true);
      expect(feedbackToneOk(f)).toBe(true);
    }
    expect(templateCommon(bars).focusAreas[0]).toContain("Basic Programming");
    expect(templateCareer(result).summary).toContain("458");
    expect(templateCareer(result).focusAreas[0]).toBe("Power BI is currently an area for development");
  });
  it("tone gate rejects labelling the person", () => {
    expect(feedbackToneOk({ summary: "Honestly you are bad at SQL and should stop.", strengths: ["x y z"], focusAreas: ["a b c"], nextStep: "do a thing today" })).toBe(false);
  });
});
