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
