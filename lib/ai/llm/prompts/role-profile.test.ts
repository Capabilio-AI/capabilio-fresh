import { describe, expect, it } from "vitest";
import { RoleProfileSchema } from "./role-profile.v1";

const skill = (i: number, over: object = {}) => ({ name: `Skill ${i}`, category: "technical", importance: i === 0 ? "CRITICAL" : "MEDIUM", assessmentWeight: 2, targetLevel: 60, minQuestions: 1, maxQuestions: 3, ...over });
const profile = (skills: unknown[]) => ({ isValidRole: true, roleName: "Game Developer", aliases: ["unity developer"], skills });
const twelve = Array.from({ length: 12 }, (_, i) => skill(i));

describe("RoleProfileSchema", () => {
  it("accepts a complete profile whose ranges can produce a 22-question assessment", () => {
    expect(RoleProfileSchema.safeParse(profile(twelve)).success).toBe(true);
  });
  it("accepts a refusal without a profile", () => {
    expect(RoleProfileSchema.safeParse({ isValidRole: false, rejectReason: "not a role" }).success).toBe(true);
  });
  it.each([
    ["too few skills", twelve.slice(0, 6)],
    ["minimums exceed the assessment", twelve.map((s) => ({ ...s, minQuestions: 3, maxQuestions: 3 }))],
    ["maximums cannot fill the assessment", twelve.map((s) => ({ ...s, minQuestions: 0, maxQuestions: 1 }))],
    ["max below min", [{ ...twelve[0], minQuestions: 3, maxQuestions: 2 }, ...twelve.slice(1)]],
    ["no critical skill", twelve.map((s) => ({ ...s, importance: "HIGH" }))],
    ["duplicate skill", [twelve[0], { ...twelve[0] }, ...twelve.slice(2)]],
    ["unknown importance", [{ ...twelve[0], importance: "URGENT" }, ...twelve.slice(1)]],
  ])("rejects %s", (_n, skills) => {
    expect(RoleProfileSchema.safeParse(profile(skills)).success).toBe(false);
  });
});

describe("same-as-existing answers", () => {
  it("need no skills, because they point at a role that already has them", () => {
    expect(RoleProfileSchema.safeParse({ isValidRole: true, sameAsExistingRole: "Data Analyst", skills: [] }).success).toBe(true);
  });
});
