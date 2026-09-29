import { describe, expect, it } from "vitest";
import { currentStageIndex, JOURNEY_STAGES, stageState } from "./stage";

describe("journey stages by year of study", () => {
  it("defaults to the first stage when the year is unknown", () => expect(currentStageIndex(null)).toBe(0));
  it("points at the first stage of the year, clamped to year 4", () => {
    expect(JOURNEY_STAGES[currentStageIndex(2)].key).toBe("develop");
    expect(JOURNEY_STAGES[currentStageIndex(3)].key).toBe("specialize");
    expect(JOURNEY_STAGES[currentStageIndex(6)].key).toBe("prove");
  });
  it("marks every stage of the current year active and earlier years done — no semester claim", () => {
    const states = JOURNEY_STAGES.map((s) => stageState(s, 3));
    expect(states).toEqual(["done", "done", "done", "active", "active", "upcoming", "upcoming"]);
  });
});
