import { describe, expect, it } from "vitest";
import { dayStarts, hm, lastBookableDay, monthGrid, toZoned, zonedToUtc } from "./grid";

describe("time zones", () => {
  it("reads a moment in the mentor's zone", () => {
    expect(toZoned("2026-11-16T12:30:00Z", "Asia/Kolkata")).toEqual({ key: "2026-11-16", minutes: 1080, weekday: 1 });
    expect(toZoned("2026-11-16T20:00:00Z", "Asia/Kolkata")).toMatchObject({ key: "2026-11-17", minutes: 90 });
  });
  it("turns a wall-clock time back into an instant, including across a daylight-saving change", () => {
    expect(zonedToUtc("2026-11-16", 1080, "Asia/Kolkata").toISOString()).toBe("2026-11-16T12:30:00.000Z");
    expect(zonedToUtc("2026-01-15", 540, "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z");
    expect(zonedToUtc("2026-07-15", 540, "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z");
    expect(zonedToUtc("2026-03-08", 720, "America/New_York").toISOString()).toBe("2026-03-08T16:00:00.000Z");
  });
  it("round-trips through toZoned", () => {
    const d = zonedToUtc("2026-11-20", 645, "Australia/Sydney");
    expect(toZoned(d, "Australia/Sydney")).toMatchObject({ key: "2026-11-20", minutes: 645 });
  });
});

describe("monthGrid", () => {
  const NOW = new Date("2026-11-18T08:00:00Z");
  it("lays November 2026 out Monday first, with the neighbouring days filling the rows", () => {
    const g = monthGrid(2026, 11, "Asia/Kolkata", NOW);
    expect(g).toHaveLength(6);
    expect(g.every((r) => r.length === 7)).toBe(true);
    expect(g[0][0]).toMatchObject({ key: "2026-10-26", inMonth: false });
    expect(g[0][6]).toMatchObject({ key: "2026-11-01", inMonth: true });
    expect(g.flat().filter((c) => c.inMonth)).toHaveLength(30);
  });
  it("marks today and the days before it", () => {
    const flat = monthGrid(2026, 11, "Asia/Kolkata", NOW).flat();
    expect(flat.find((c) => c.today)?.key).toBe("2026-11-18");
    expect(flat.find((c) => c.key === "2026-11-17")?.past).toBe(true);
    expect(flat.find((c) => c.key === "2026-11-19")?.past).toBe(false);
  });
  it("uses five rows when the month fits", () => expect(monthGrid(2026, 2, "Asia/Kolkata", NOW)).toHaveLength(5));
});

describe("day times", () => {
  it("offers one start per session length between 06:00 and 22:00", () => {
    expect(dayStarts(60)[0]).toBe(360);
    expect(dayStarts(60).at(-1)).toBe(1260);
    expect(dayStarts(30)).toHaveLength(32);
    expect(dayStarts(45).at(-1)! + 45).toBeLessThanOrEqual(1320);
  });
  it("formats minutes and finds the last bookable day", () => {
    expect(hm(1080)).toBe("18:00");
    expect(lastBookableDay(new Date("2026-11-16T00:00:00Z"), "Asia/Kolkata")).toBe("2027-02-14");
  });
});
