import { describe, expect, it } from "vitest";
import { ago, engravedDate, shortDate } from "./format";

describe("badge dates", () => {
  it("formats in Indian time, so a late-night completion keeps the student's date", () => {
    expect(shortDate("2026-10-15T20:30:00Z")).toBe("16 Oct 2026");
    expect(engravedDate("2026-10-15T20:30:00Z")).toEqual({ line1: "16 OCT", line2: "2026" });
  });
  it("always uses a three-letter month", () => {
    expect(shortDate("2026-09-13T06:00:00Z")).toBe("13 Sep 2026");
  });
  it("says so when there is no date, instead of inventing one", () => {
    expect(shortDate(null)).toBeNull();
    expect(shortDate("not a date")).toBeNull();
    expect(engravedDate(null)).toEqual({ line1: "DATE NOT", line2: "RECORDED" });
  });
  it("describes how long ago in plain words", () => {
    const now = new Date("2026-10-16T00:00:00Z");
    expect(ago("2026-10-16T00:00:00Z", now)).toBe("today");
    expect(ago("2026-10-15T00:00:00Z", now)).toBe("yesterday");
    expect(ago("2026-10-06T00:00:00Z", now)).toBe("10 days ago");
    expect(ago("2026-07-16T00:00:00Z", now)).toBe("3 months ago");
    expect(ago("2024-10-16T00:00:00Z", now)).toBe("2 years ago");
    expect(ago(null, now)).toBeNull();
  });
});
