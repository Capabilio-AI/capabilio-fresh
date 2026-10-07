import { describe, expect, it } from "vitest";
import { MentorApplicationSchema, needsReReview, normalizeExpertise } from "./mentor-schema";

const valid = { headline: "SDE at a product company", bio: "I help students prepare for backend interviews and system design.", expertise: ["System Design", "Java"] };

describe("MentorApplicationSchema", () => {
  it("accepts a complete application and cleans the tags", () => {
    const r = MentorApplicationSchema.parse({ ...valid, expertise: [" Java ", "java", "Java", "SQL"], company: "", yearsExperience: "6" });
    expect(r.expertise).toEqual(["Java", "java", "SQL"].filter((t, i, a) => a.indexOf(t) === i));
    expect(r.company).toBeUndefined();
    expect(r.yearsExperience).toBe(6);
  });
  it("rejects a thin bio, no expertise, too many tags and unknown fields", () => {
    expect(MentorApplicationSchema.safeParse({ ...valid, bio: "short" }).success).toBe(false);
    expect(MentorApplicationSchema.safeParse({ ...valid, expertise: [] }).success).toBe(false);
    expect(MentorApplicationSchema.safeParse({ ...valid, expertise: Array.from({ length: 9 }, (_, i) => `t${i}`) }).success).toBe(false);
    expect(MentorApplicationSchema.safeParse({ ...valid, status: "approved" }).success).toBe(false);
  });
});

describe("needsReReview", () => {
  const base = MentorApplicationSchema.parse(valid);
  it("sends public text changes back for review, but not availability", () => {
    expect(needsReReview(base, { ...base, bio: base.bio + " More." })).toBe(true);
    expect(needsReReview(base, { ...base, expertise: ["Go"] })).toBe(true);
    expect(needsReReview(base, { ...base, availability: "Weekends" })).toBe(false);
  });
});
describe("normalizeExpertise", () => {
  it("trims, collapses spaces and drops blanks", () => {
    expect(normalizeExpertise(["  Data   Science ", "", "x"])).toEqual(["Data Science", "x"]);
  });
});
