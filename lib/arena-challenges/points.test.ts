import { describe, expect, it } from "vitest";
import { pickTaskCount, pointsForDifficulty, TASK_COUNT_OPTIONS } from "./points";

describe("pointsForDifficulty", () => {
  it("maps each difficulty to its fixed point value", () => {
    expect(pointsForDifficulty("easy")).toBe(50);
    expect(pointsForDifficulty("medium")).toBe(70);
    expect(pointsForDifficulty("hard")).toBe(100);
  });

  it("defaults to the easy value for an unrecognized difficulty rather than throwing", () => {
    expect(pointsForDifficulty("unknown")).toBe(50);
  });
});

describe("pickTaskCount", () => {
  it("always returns a value from the wheel's real option set", () => {
    for (let i = 0; i < 50; i++) {
      expect(TASK_COUNT_OPTIONS).toContain(pickTaskCount());
    }
  });
});
