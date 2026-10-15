import { describe, expect, it } from "vitest";
import { buildPipeline, currentStep } from "./pipeline";

describe("graduate job-hunt pipeline", () => {
  it("starts at the assessment for someone with nothing yet", () => {
    const steps = buildPipeline({ hasLevel: false, proofCount: 0, interviewCount: 0, applicationCount: 0 });
    expect(steps.map((s) => s.done)).toEqual([false, false, false, false]);
    expect(currentStep(steps)?.key).toBe("level");
  });

  it("marks only what is really done and points at the first gap", () => {
    const steps = buildPipeline({ hasLevel: true, proofCount: 2, interviewCount: 0, applicationCount: 1 });
    expect(steps.map((s) => s.done)).toEqual([true, true, false, true]);
    expect(currentStep(steps)?.key).toBe("interview");
  });

  it("has no current step once every station is done", () => {
    expect(currentStep(buildPipeline({ hasLevel: true, proofCount: 1, interviewCount: 1, applicationCount: 1 }))).toBeNull();
  });
});
