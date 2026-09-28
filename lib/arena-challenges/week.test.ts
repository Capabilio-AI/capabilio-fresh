import { describe, expect, it } from "vitest";
import { weekStartOf, weeksBetween } from "./week";

describe("weekStartOf", () => {
  it("returns the same Monday for any day within that week", () => {
    // 2026-09-28 is a Monday.
    expect(weekStartOf(new Date("2026-09-28T00:00:00Z"))).toBe("2026-09-28");
    expect(weekStartOf(new Date("2026-09-30T12:00:00Z"))).toBe("2026-09-28");
    expect(weekStartOf(new Date("2026-10-04T23:59:00Z"))).toBe("2026-09-28"); // Sunday, still that week
  });

  it("rolls over to the next Monday once the week ends", () => {
    expect(weekStartOf(new Date("2026-10-05T00:00:00Z"))).toBe("2026-10-05");
  });
});

describe("weeksBetween", () => {
  it("is 0 for the same week", () => {
    expect(weeksBetween("2026-09-28", "2026-09-28")).toBe(0);
  });

  it("is 1 for consecutive weeks", () => {
    expect(weeksBetween("2026-09-28", "2026-10-05")).toBe(1);
  });

  it("is more than 1 when a week was skipped", () => {
    expect(weeksBetween("2026-09-28", "2026-10-12")).toBe(2);
  });
});
