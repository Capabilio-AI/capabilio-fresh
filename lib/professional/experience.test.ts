import { describe, expect, it } from "vitest";
import { experienceMonths, fmtExperience, parsePeriod, spanOf } from "./experience";

const NOW = new Date("2026-11-16T00:00:00Z");
const text = (period_text: string) => ({ start_date: null, end_date: null, period_text });

describe("parsePeriod", () => {
  it("reads month/year, month-name and plain year forms", () => {
    expect(parsePeriod("08/2017 - 09/2018")).toEqual({ start: { year: 2017, month: 8 }, end: { year: 2018, month: 9 } });
    expect(parsePeriod("Jan 2019 – Present")).toEqual({ start: { year: 2019, month: 1 }, end: "present" });
    expect(parsePeriod("2015 - 2018")).toEqual({ start: { year: 2015, month: null }, end: { year: 2018, month: null } });
    expect(parsePeriod("March 2020 to date")).toMatchObject({ start: { year: 2020, month: 3 } });
  });
  it("is null when no year can be read", () => {
    expect(parsePeriod("last summer")).toBeNull();
    expect(parsePeriod("Present - 2020")).toBeNull();
    expect(parsePeriod("1950 - 1960")).toBeNull();
  });
});

describe("experienceMonths", () => {
  it("uses exact dates when given", () => expect(experienceMonths([{ start_date: "2020-01-01", end_date: "2021-01-01", period_text: null }], NOW)).toBe(12));
  it("falls back to the resume wording", () => expect(experienceMonths([text("08/2017 - 09/2018")], NOW)).toBe(13));
  it("counts overlap once and ignores gaps and unreadable rows", () => {
    const rows = [text("2010 - 2015"), text("2014 - 2016"), text("2018 - 2019"), text("no dates")];
    // plain years are read inclusively: 2010 to 2016 (as 2010 - 2015 and 2014 - 2016 merge) and 2018 to 2020
    const months = experienceMonths(rows, NOW);
    expect(months).toBeGreaterThanOrEqual(107);
    expect(months).toBeLessThanOrEqual(108);
  });
  it("runs an open period to today but never into the future", () => {
    expect(experienceMonths([text("Nov 2025 - Present")], NOW)).toBe(12);
    expect(spanOf(text("2030 - 2031"), NOW)).toBeNull();
  });
});

describe("fmtExperience", () => {
  it("reads like a person", () => expect([0, 8, 12, 159].map(fmtExperience)).toEqual(["0 months", "8 months", "1 year", "13 years 3 months"]));
});
