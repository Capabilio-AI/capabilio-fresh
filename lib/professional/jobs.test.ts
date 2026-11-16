import { describe, expect, it } from "vitest";
import { validateAbout, validateJob } from "./jobs";

const NOW = new Date("2026-11-16T00:00:00Z");
const base = { employerName: " Northwind   Systems ", jobTitle: "Engineer", start: "2021-06" };

describe("validateJob", () => {
  it("accepts a current job and tidies the text", () => {
    expect(validateJob({ ...base, current: true }, NOW)).toEqual({ ok: true, value: { employerName: "Northwind Systems", jobTitle: "Engineer", start: "2021-06-01", end: null } });
  });
  it("accepts a past job with an end month", () => expect(validateJob({ ...base, end: "2023-01" }, NOW)).toMatchObject({ ok: true, value: { end: "2023-01-01" } }));
  it("needs an end month unless current", () => expect(validateJob(base, NOW).ok).toBe(false));
  it("refuses an end before the start, and future or malformed months", () => {
    expect(validateJob({ ...base, end: "2020-01" }, NOW).ok).toBe(false);
    expect(validateJob({ ...base, start: "2027-01", current: true }, NOW).ok).toBe(false);
    expect(validateJob({ ...base, start: "2021-13", current: true }, NOW).ok).toBe(false);
    expect(validateJob({ ...base, start: "1950-01", current: true }, NOW).ok).toBe(false);
  });
  it("refuses blank or over-long employer and title", () => {
    expect(validateJob({ ...base, employerName: "  ", current: true }, NOW).ok).toBe(false);
    expect(validateJob({ ...base, jobTitle: "x".repeat(121), current: true }, NOW).ok).toBe(false);
    expect(validateJob(null, NOW).ok).toBe(false);
  });
});

describe("validateAbout", () => {
  it("turns empty fields into null and keeps the rest", () => {
    expect(validateAbout({ headline: " Data Analyst ", location: "", about: "  " })).toEqual({ ok: true, value: { headline: "Data Analyst", location: null, about: null } });
  });
  it("refuses over-long text instead of cutting it", () => {
    expect(validateAbout({ about: "x".repeat(1201) }).ok).toBe(false);
    expect(validateAbout({ headline: "x".repeat(161) }).ok).toBe(false);
  });
});
