import { describe, expect, it } from "vitest";
import { PlanBBodySchema, validatePlanB } from "./plan-b-rules";

const MAIN = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ACTIVE = new Set([MAIN, OTHER]);

describe("validatePlanB", () => {
  it("accepts higher studies, entrepreneur and undecided without a main career", () => {
    for (const kind of ["higher_studies", "entrepreneur", "undecided"] as const) expect(validatePlanB({ kind }, null, ACTIVE).ok).toBe(true);
  });
  it("needs a main career for same_role and change_role", () => {
    expect(validatePlanB({ kind: "same_role" }, null, ACTIVE).ok).toBe(false);
    expect(validatePlanB({ kind: "change_role", careerId: OTHER }, null, ACTIVE).ok).toBe(false);
  });
  it("accepts same_role with a main career", () => {
    expect(validatePlanB({ kind: "same_role" }, MAIN, ACTIVE).ok).toBe(true);
  });
  it("change_role needs a different, active career", () => {
    expect(validatePlanB({ kind: "change_role", careerId: OTHER }, MAIN, ACTIVE).ok).toBe(true);
    expect(validatePlanB({ kind: "change_role" }, MAIN, ACTIVE).ok).toBe(false);
    expect(validatePlanB({ kind: "change_role", careerId: MAIN }, MAIN, ACTIVE).ok).toBe(false);
    expect(validatePlanB({ kind: "change_role", careerId: "33333333-3333-4333-8333-333333333333" }, MAIN, ACTIVE).ok).toBe(false);
  });
  it("rejects a career attached to any other kind", () => {
    expect(validatePlanB({ kind: "higher_studies", careerId: OTHER }, MAIN, ACTIVE).ok).toBe(false);
  });
});

describe("PlanBBodySchema", () => {
  it("rejects unknown kinds and extra keys", () => {
    expect(PlanBBodySchema.safeParse({ kind: "gap_year" }).success).toBe(false);
    expect(PlanBBodySchema.safeParse({ kind: "undecided", studentId: "x" }).success).toBe(false);
    expect(PlanBBodySchema.safeParse({ kind: "undecided" }).success).toBe(true);
  });
});
