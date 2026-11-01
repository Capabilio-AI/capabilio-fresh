import { describe, expect, it } from "vitest";
import { BRANCH_WAVE_ROLES, LAUNCH_ROLES } from "./launch";

describe("launch waves", () => {
  it("wave 1 is exactly the 15 IT roles", () => {
    expect(LAUNCH_ROLES).toHaveLength(15);
    expect(LAUNCH_ROLES.every((r) => r.stream === "IT")).toBe(true);
  });

  it("wave 2 is exactly three roles for each of the four branches", () => {
    const n = (s: string) => BRANCH_WAVE_ROLES.filter((r) => r.stream === s).length;
    expect([n("MECH"), n("CIVIL"), n("ECE"), n("EEE"), BRANCH_WAVE_ROLES.length]).toEqual([3, 3, 3, 3, 12]);
  });
});
