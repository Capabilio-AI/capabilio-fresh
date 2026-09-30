import { describe, expect, it } from "vitest";
import { pointsForDifficulty } from "./points";

describe("pointsForDifficulty", () => {
  it("maps each difficulty to its fixed point value", () => {
    expect(pointsForDifficulty("easy")).toBe(15);
    expect(pointsForDifficulty("medium")).toBe(20);
    expect(pointsForDifficulty("hard")).toBe(25);
  });

  it("defaults to the easy value for an unrecognized difficulty rather than throwing", () => {
    expect(pointsForDifficulty("unknown")).toBe(15);
  });
});
