import { describe, expect, it } from "vitest";
import { levelLabel } from "./ReportView";

describe("levelLabel", () => {
  it("never shows 'not assessed' as a low mark", () => {
    expect(levelLabel(null)).toBe("Not assessed");
    expect(levelLabel(0)).toBe("Not shown");
    expect([1, 2, 3].map((l) => levelLabel(l as 1 | 2 | 3))).toEqual(["Basic", "Solid", "Strong"]);
  });
});
