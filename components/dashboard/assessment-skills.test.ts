import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentSkills, assessmentSummary } from "./AssessmentSkills";
import type { SkillResult } from "@/lib/assess/scoring";

const skill = (name: string, over: Partial<SkillResult> = {}): SkillResult => ({ skillId: name, key: name, name, category: null, importance: "HIGH", targetLevel: 70, weight: 1, score: null, confidence: "INSUFFICIENT", evidenceCount: 0, proof: 0, ...over });

describe("assessment skills tab", () => {
  it("counts the skills asked and the skills proven by real work", () => {
    expect(assessmentSummary([skill("A", { score: 35, evidenceCount: 2, confidence: "MEDIUM" }), skill("B", { score: 40, proof: 1 }), skill("C")])).toEqual({ total: 3, asked: 2, proven: 1 });
  });
  it("shows what the assessment measured and says plainly that it is a starting point, not proof", () => {
    const out = renderToStaticMarkup(createElement(AssessmentSkills, { roleName: "Data Scientist", skills: [skill("Python", { score: 35, evidenceCount: 3, confidence: "HIGH" }), skill("Deep Learning")] }));
    expect(out).toContain("Assessment skills");
    expect(out).toContain("not what you have proven");
    expect(out).toContain("2 of 2 skills asked".replace("2 of 2", "1 of 2"));
    expect(out).toContain("3 answers");
    expect(out).toContain("High confidence");
    expect(out).toContain("Not asked");
    expect(out).toContain("not yet proven");
  });
  it("has a message instead of an empty list when the role has no skills yet", () => {
    expect(renderToStaticMarkup(createElement(AssessmentSkills, { roleName: "X", skills: [] }))).toContain("not ready yet");
  });
});
