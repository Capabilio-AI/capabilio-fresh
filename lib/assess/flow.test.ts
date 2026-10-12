import { describe, expect, it } from "vitest";
import { decideStage } from "./flow";

const none = { primary: false, exploring: false };
describe("decideStage", () => {
  it("asks for career interest first", () => {
    expect(decideStage("ASSESSMENT_REQUIRED", none)).toBe("career-interest");
  });
  it("goes general, then career, then done once a career is confirmed", () => {
    const yes = { primary: true, exploring: false };
    expect(decideStage("ASSESSMENT_REQUIRED", yes)).toBe("general");
    expect(decideStage("COMMON_ASSESSMENT_COMPLETE", yes)).toBe("career");
    expect(decideStage("PROFILE_READY", yes)).toBe("done");
  });
  it("lets an exploring student take the general assessment, then requires a confirmed career", () => {
    const exploring = { primary: false, exploring: true };
    expect(decideStage("ASSESSMENT_REQUIRED", exploring)).toBe("general");
    expect(decideStage("COMMON_ASSESSMENT_COMPLETE", exploring)).toBe("career-interest");
  });
});

describe("decideStage for recently graduated accounts", () => {
  const grad = (hasResume: boolean) => ({ isGraduate: true, hasResume });
  it("asks for the resume first, then the role, then goes straight to the one role assessment (no general layer)", () => {
    expect(decideStage("ASSESSMENT_REQUIRED", none, grad(false))).toBe("resume");
    expect(decideStage("ASSESSMENT_REQUIRED", none, grad(true))).toBe("career-interest");
    expect(decideStage("ASSESSMENT_REQUIRED", { primary: true, exploring: false }, grad(true))).toBe("career");
  });
  it("is done once the role assessment is finished, whatever else is missing", () => {
    expect(decideStage("PROFILE_READY", none, grad(false))).toBe("done");
    expect(decideStage("CAREER_ASSESSMENT_COMPLETE", none, grad(true))).toBe("done");
  });
  it("does not change anything for current students", () => {
    expect(decideStage("ASSESSMENT_REQUIRED", { primary: true, exploring: false }, { isGraduate: false, hasResume: false })).toBe("general");
  });
});

