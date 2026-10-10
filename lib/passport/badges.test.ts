import { describe, expect, it } from "vitest";
import type { SkillResult } from "@/lib/assess/scoring";
import { badgeLevel, passportSkills } from "./badges";

const skill = (key: string, score: number | null, confidence: SkillResult["confidence"] = "HIGH"): SkillResult => ({
  skillId: key, key, name: key, category: null, importance: "HIGH", targetLevel: 70, weight: 1, score, confidence, evidenceCount: score === null ? 0 : 3,
});

describe("badgeLevel", () => {
  it("needs a score and trustworthy evidence", () => {
    expect(badgeLevel(null, "HIGH")).toBeNull();
    expect(badgeLevel(90, "INSUFFICIENT")).toBeNull();
    expect(badgeLevel(39, "HIGH")).toBeNull();
  });
  it("steps up at 40, 60 and 80", () => {
    expect(badgeLevel(40, "HIGH")).toBe("Foundation");
    expect(badgeLevel(60, "MEDIUM")).toBe("Proficient");
    expect(badgeLevel(80, "HIGH")).toBe("Advanced");
  });
});

describe("passportSkills", () => {
  it("orders earned badges first, highest level first, and keeps honest statuses", () => {
    const out = passportSkills([skill("a", null), skill("b", 85), skill("c", 30), skill("d", 62, "LOW")]);
    expect(out.map((s) => [s.name, s.status])).toEqual([["b", "earned"], ["d", "earned"], ["a", "not-assessed"], ["c", "building"]]);
    expect(out[1].badge?.provisional).toBe(true);
  });
});
