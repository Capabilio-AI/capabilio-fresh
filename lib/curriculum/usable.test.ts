import { describe, expect, it } from "vitest";
import { isUsable } from "./mapping-rules";

const row = (over: Partial<Parameters<typeof isUsable>[0]>) => ({ status: "SUGGESTED" as const, source: "AI_SUGGESTED" as const, confidence: 0.9, evidence: "UNIT II Searching ...", ...over });

describe("isUsable (what may drive a student's roadmap)", () => {
  it("accepts a skill a person confirmed", () => expect(isUsable({ status: "CONFIRMED", source: "COLLEGE_CONFIRMED" })).toBe(true));
  it("accepts a high-confidence suggestion that carries a quoted line from the syllabus", () => expect(isUsable(row({}))).toBe(true));
  it("rejects a low-confidence suggestion", () => expect(isUsable(row({ confidence: 0.6 }))).toBe(false));
  it("rejects a suggestion without evidence", () => {
    expect(isUsable(row({ evidence: null }))).toBe(false);
    expect(isUsable(row({ evidence: "   " }))).toBe(false);
  });
  it("never uses a rejected skill, however confident the model was", () => expect(isUsable(row({ status: "REJECTED" }))).toBe(false));
});
