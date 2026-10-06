import { describe, expect, it } from "vitest";
import { STEPS, stepFrom } from "./steps";

describe("wizard steps", () => {
  it("follows the product's order", () => {
    expect(STEPS.map((s) => s.label)).toEqual(["Upload", "Academic structure", "Courses", "Learning outcomes", "Skill mappings", "Career relevance", "Confirm", "Publish"]);
  });
  it("falls back to the first step for anything unknown", () => {
    expect(stepFrom("courses")).toBe("courses");
    expect(stepFrom(["mappings", "x"])).toBe("mappings");
    expect(stepFrom("../../etc")).toBe("upload");
    expect(stepFrom(undefined)).toBe("upload");
  });
});
