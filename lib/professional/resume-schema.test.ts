import { describe, expect, it } from "vitest";
import { ProResumeSchema, normalizeMonth } from "./resume-schema";

describe("normalizeMonth", () => {
  it("reads the common ways a resume writes a date", () => {
    expect(["2019-03", "03/2019", "3.2019", "Mar 2019", "March, 2019", "2019", "2019-03-15"].map(normalizeMonth)).toEqual(["2019-03", "2019-03", "2019-03", "2019-03", "2019-03", "2019", "2019-03"]);
  });
  it("is null for anything it cannot trust", () => {
    expect(["Present", "", "13/2019", "1900", "yesterday", 2019, null].map(normalizeMonth)).toEqual([null, null, null, null, null, null, null]);
  });
});

describe("ProResumeSchema", () => {
  it("keeps a good job and never fails the read because of one odd date", () => {
    const r = ProResumeSchema.parse({ isResume: true, experience: [{ title: "Analyst", organisation: "Metallco", startDate: "08/2017", endDate: "garbage", current: false, period: "08/2017 - 09/2018", description: "Built reports." }] });
    expect(r.experience[0]).toMatchObject({ startDate: "2017-08", endDate: null, current: false, period: "08/2017 - 09/2018" });
  });
  it("fills every list and field a resume can leave out", () => {
    const r = ProResumeSchema.parse({ isResume: true });
    expect(r.experience).toEqual([]);
    expect(r.awards).toEqual([]);
    expect(r.languages).toEqual([]);
    expect(r.summary).toEqual({ headline: null, about: null });
  });
  it("accepts awards, languages and a current job", () => {
    const r = ProResumeSchema.parse({ isResume: true, awards: [{ title: "Employee of the Year", issuer: "Metallco", year: 2023 }], languages: ["English", "Hindi"], experience: [{ title: "Lead", startDate: "2021-06", current: true }] });
    expect(r.awards[0].year).toBe(2023);
    expect(r.experience[0].current).toBe(true);
  });
});
