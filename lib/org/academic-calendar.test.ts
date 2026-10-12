import { describe, expect, it } from "vitest";
import { semesterFromCalendar, type CalendarRow } from "./academic-calendar";

const row = (branchKey: string, yearOfStudy: number, semester: 1 | 2, startsOn: string): CalendarRow => ({ branchKey, yearOfStudy, semester, startsOn });
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("semesterFromCalendar", () => {
  const all = [row("*", 0, 1, "2026-07-01"), row("*", 0, 2, "2027-01-05")];
  it("is null with no dates, or before any has started", () => {
    expect(semesterFromCalendar([], "CSE", 3, at("2026-10-01"))).toBeNull();
    expect(semesterFromCalendar(all, "CSE", 3, at("2026-06-01"))).toBeNull();
  });
  it("uses the latest start date already reached", () => {
    expect(semesterFromCalendar(all, "CSE", 3, at("2026-10-01"))).toBe(1);
    expect(semesterFromCalendar(all, "CSE", 3, at("2027-01-05"))).toBe(2);
  });
  it("a branch-and-year row wins over the wildcard", () => {
    const rows = [...all, row("cse", 3, 2, "2026-09-01")];
    expect(semesterFromCalendar(rows, " CSE ", 3, at("2026-10-01"))).toBe(2);
    expect(semesterFromCalendar(rows, "ECE", 3, at("2026-10-01"))).toBe(1);
    expect(semesterFromCalendar(rows, "CSE", 2, at("2026-10-01"))).toBe(1);
  });
});

import { CalendarEntrySchema } from "./academic-calendar";
describe("CalendarEntrySchema", () => {
  const ok = { branch: "CSE", yearOfStudy: 3, semester: 1, startsOn: "2026-07-01", endsOn: "2026-12-15" };
  it("accepts a valid semester window", () => expect(CalendarEntrySchema.safeParse(ok).success).toBe(true));
  it("rejects an end date before the start", () => expect(CalendarEntrySchema.safeParse({ ...ok, endsOn: "2026-06-01" }).success).toBe(false));
});
