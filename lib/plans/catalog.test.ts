import { describe, expect, it } from "vitest";
import { ENFORCE_PLANS, interviewQuotaReached, interviewUnlocked, isPlanId, planAllows, planById, planSelectionError } from "./catalog";

describe("plan catalog", () => {
  it("recognises only real plan ids", () => {
    expect(isPlanId("free")).toBe(true);
    expect(isPlanId("platinum")).toBe(false);
    expect(planById("nope")).toBeNull();
  });

  it("gates AI Interview to the paid plans and fails closed when no plan is chosen", () => {
    expect(planAllows("free", "aiInterview")).toBe(false);
    expect(planAllows("pro", "aiInterview")).toBe(true);
    expect(planAllows("elite", "aiInterview")).toBe(true);
    expect(planAllows(null, "aiInterview")).toBe(false);
  });
});

describe("interviewUnlocked", () => {
  it("follows the stage", () => {
    expect(interviewUnlocked("student", null, false)).toBe(false);
    expect(interviewUnlocked("student", null, true)).toBe(true);
    expect(interviewUnlocked("graduate", "free", true, true)).toBe(false);
    expect(interviewUnlocked("graduate", "pro", false, true)).toBe(true);
    expect(interviewUnlocked("professional", null, false)).toBe(true);
  });

  it("blocks nobody while plans are not enforced, because nobody can pay yet", () => {
    expect(ENFORCE_PLANS).toBe(false);
    expect(interviewUnlocked("graduate", "free", false)).toBe(true);
    expect(interviewUnlocked("graduate", null, false)).toBe(true);
  });
});

describe("interviewQuotaReached", () => {
  it("never limits while plans are not enforced", () => {
    expect(interviewQuotaReached(99, "free", false)).toBe(false);
  });
  it("applies 1 / 8 / 15 per plan when enforced, Free if unchosen", () => {
    expect(interviewQuotaReached(1, "free", true)).toBe(true);
    expect(interviewQuotaReached(1, null, true)).toBe(true);
    expect(interviewQuotaReached(7, "pro", true)).toBe(false);
    expect(interviewQuotaReached(8, "pro", true)).toBe(true);
    expect(interviewQuotaReached(14, "elite", true)).toBe(false);
    expect(interviewQuotaReached(15, "elite", true)).toBe(true);
  });
});

describe("planSelectionError", () => {
  it("allows everything while plans are not enforced", () => {
    expect(planSelectionError("pro", false)).toBeNull();
  });
  it("refuses paid plans when enforced, but not Free", () => {
    expect(planSelectionError("pro", true)).toMatch(/Payments are not available/);
    expect(planSelectionError("elite", true)).not.toBeNull();
    expect(planSelectionError("free", true)).toBeNull();
  });
});
