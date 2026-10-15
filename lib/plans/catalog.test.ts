import { describe, expect, it } from "vitest";
import { ENFORCE_PLANS, interviewUnlocked, isPlanId, planAllows, planById } from "./catalog";

describe("plan catalog", () => {
  it("recognises only real plan ids", () => {
    expect(isPlanId("launch")).toBe(true);
    expect(isPlanId("platinum")).toBe(false);
    expect(planById("nope")).toBeNull();
  });

  it("gates AI Interview to the paid plans and fails closed when no plan is chosen", () => {
    expect(planAllows("launch", "aiInterview")).toBe(false);
    expect(planAllows("accelerate_monthly", "aiInterview")).toBe(true);
    expect(planAllows("accelerate_quarterly", "aiInterview")).toBe(true);
    expect(planAllows(null, "aiInterview")).toBe(false);
  });
});

describe("interviewUnlocked", () => {
  it("follows the stage", () => {
    expect(interviewUnlocked("student", null, false)).toBe(false);
    expect(interviewUnlocked("student", null, true)).toBe(true);
    expect(interviewUnlocked("graduate", "launch", true, true)).toBe(false);
    expect(interviewUnlocked("graduate", "accelerate_monthly", false, true)).toBe(true);
    expect(interviewUnlocked("professional", null, false)).toBe(true);
  });

  it("blocks nobody while plans are not enforced, because nobody can pay yet", () => {
    expect(ENFORCE_PLANS).toBe(false);
    expect(interviewUnlocked("graduate", "launch", false)).toBe(true);
    expect(interviewUnlocked("graduate", null, false)).toBe(true);
  });
});
