import { describe, expect, it } from "vitest";
import { ROLE_CHANGE_LIMIT, RoleChangeBodySchema, roleChangesLeft } from "./role-change-rules";

const CAREER = "11111111-1111-4111-8111-111111111111";

describe("roleChangesLeft", () => {
  it("counts down from the limit and never goes below zero", () => {
    expect(roleChangesLeft(0)).toBe(ROLE_CHANGE_LIMIT);
    expect(roleChangesLeft(2)).toBe(1);
    expect(roleChangesLeft(ROLE_CHANGE_LIMIT)).toBe(0);
    expect(roleChangesLeft(ROLE_CHANGE_LIMIT + 4)).toBe(0);
  });
});

describe("RoleChangeBodySchema", () => {
  it("accepts a listed reason without details", () => {
    expect(RoleChangeBodySchema.safeParse({ careerId: CAREER, reason: "better_fit" }).success).toBe(true);
  });
  it("needs a real sentence for 'something else'", () => {
    expect(RoleChangeBodySchema.safeParse({ careerId: CAREER, reason: "other" }).success).toBe(false);
    expect(RoleChangeBodySchema.safeParse({ careerId: CAREER, reason: "other", details: "too short" }).success).toBe(false);
    expect(RoleChangeBodySchema.safeParse({ careerId: CAREER, reason: "other", details: "I want to move into hardware work" }).success).toBe(true);
  });
  it("needs a reason, a career id and nothing extra", () => {
    expect(RoleChangeBodySchema.safeParse({ careerId: CAREER }).success).toBe(false);
    expect(RoleChangeBodySchema.safeParse({ reason: "better_fit" }).success).toBe(false);
    expect(RoleChangeBodySchema.safeParse({ careerId: "not-a-uuid", reason: "better_fit" }).success).toBe(false);
    expect(RoleChangeBodySchema.safeParse({ careerId: CAREER, reason: "better_fit", studentId: CAREER }).success).toBe(false);
    expect(RoleChangeBodySchema.safeParse({ careerId: CAREER, reason: "made_up" }).success).toBe(false);
  });
});
