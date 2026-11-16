import { describe, expect, it } from "vitest";
import { VERIFY_WINDOW_DAYS, verifyWindow, windowFromDeadline } from "./verification";

const START = "2026-11-10T08:00:00.000Z";

describe("verifyWindow", () => {
  it("gives seven days from sign-up", () => {
    const w = verifyWindow(START, new Date(START))!;
    expect(VERIFY_WINDOW_DAYS).toBe(7);
    expect(w).toMatchObject({ deadline: "2026-11-17T08:00:00.000Z", daysLeft: 7, overdue: false });
  });
  it("rounds a part day up and counts down", () => {
    expect(verifyWindow(START, new Date("2026-11-16T09:00:00.000Z"))!.daysLeft).toBe(1);
    expect(verifyWindow(START, new Date("2026-11-13T08:00:00.000Z"))!.daysLeft).toBe(4);
  });
  it("is overdue at the deadline and never shows negative days", () => {
    expect(verifyWindow(START, new Date("2026-11-17T08:00:00.000Z"))).toMatchObject({ daysLeft: 0, overdue: true });
    expect(verifyWindow(START, new Date("2026-12-30T00:00:00.000Z"))).toMatchObject({ daysLeft: 0, overdue: true });
  });
  it("gives the same answer from a stored deadline", () => {
    expect(windowFromDeadline("2026-11-17T08:00:00.000Z", new Date("2026-11-16T09:00:00.000Z"))).toMatchObject({ daysLeft: 1, overdue: false });
    expect(windowFromDeadline("nope")).toBeNull();
  });
  it("is null for a date that cannot be read", () => expect(verifyWindow("not a date")).toBeNull());
});
