import { describe, expect, it } from "vitest";
import { currentStageIndex, isStageUnlocked, JOURNEY_STAGES, UNLOCK_STAGE_KEY } from "./stage";

describe("currentStageIndex", () => {
  it("defaults to the first stage when year is null", () => {
    expect(currentStageIndex(null)).toBe(0);
  });

  it("maps a fresh 1-1 student to the first stage", () => {
    expect(currentStageIndex("1-1")).toBe(0);
  });

  it("maps 3-2 to the Experience stage", () => {
    const experienceIndex = JOURNEY_STAGES.findIndex((s) => s.key === "experience");
    expect(currentStageIndex("3-2")).toBe(experienceIndex);
  });

  it("maps the final stage 4-2 to the last index", () => {
    expect(currentStageIndex("4-2")).toBe(JOURNEY_STAGES.length - 1);
  });
});

describe("isStageUnlocked", () => {
  it("keeps Launchpad/Interview locked before 3-2, regardless of year progressing", () => {
    expect(isStageUnlocked("1-1", UNLOCK_STAGE_KEY)).toBe(false);
    expect(isStageUnlocked("3-1", UNLOCK_STAGE_KEY)).toBe(false);
  });

  it("unlocks at 3-2 and stays unlocked afterward", () => {
    expect(isStageUnlocked("3-2", UNLOCK_STAGE_KEY)).toBe(true);
    expect(isStageUnlocked("4-2", UNLOCK_STAGE_KEY)).toBe(true);
  });

  it("treats a null year as locked (the safest default for an unknown student)", () => {
    expect(isStageUnlocked(null, UNLOCK_STAGE_KEY)).toBe(false);
  });
});
