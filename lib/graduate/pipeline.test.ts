import { describe, expect, it } from "vitest";
import { buildPipeline, currentStep } from "./pipeline";

describe("buildPipeline", () => {
  it("marks a station done only when real data says so", () => {
    const steps = buildPipeline({ hasLevel: true, provenCount: 0, interviewCount: 0, applicationCount: 0 });
    expect(steps.map((s) => s.done)).toEqual([true, false, false, false]);
    expect(currentStep(steps)?.key).toBe("proof");
  });
  it("counts proof as skills proven by work, not documents uploaded or quiz answers", () => {
    const steps = buildPipeline({ hasLevel: true, provenCount: 2, interviewCount: 1, applicationCount: 0 });
    expect(steps[1]).toMatchObject({ done: true, detail: "2 skills proven" });
    expect(currentStep(steps)?.key).toBe("apply");
  });
  it("starts at the assessment for someone with nothing yet", () => {
    const steps = buildPipeline({ hasLevel: false, provenCount: 0, interviewCount: 0, applicationCount: 0 });
    expect(steps.map((s) => s.done)).toEqual([false, false, false, false]);
    expect(currentStep(steps)?.key).toBe("level");
  });
  it("has no current step once all four are done", () => {
    expect(currentStep(buildPipeline({ hasLevel: true, provenCount: 1, interviewCount: 1, applicationCount: 1 }))).toBeNull();
  });
});
