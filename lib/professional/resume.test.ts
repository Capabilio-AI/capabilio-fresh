import { describe, expect, it } from "vitest";
import { ProResumeSchema } from "./resume-schema";
import { employmentDates, proRowsFrom } from "./resume";

const j = (over: Partial<Parameters<typeof employmentDates>[0]> = {}) => ({ startDate: null, endDate: null, current: false, period: null, ...over });

describe("employmentDates", () => {
  it("stores whole months: first day to last day", () => {
    expect(employmentDates(j({ startDate: "2017-08", endDate: "2018-09" }))).toEqual({ start_date: "2017-08-01", end_date: "2018-09-30" });
  });
  it("treats a year-only end as the end of that year", () => {
    expect(employmentDates(j({ startDate: "2015", endDate: "2018" }))).toEqual({ start_date: "2015-01-01", end_date: "2018-12-31" });
  });
  it("leaves a job open only when it is current", () => {
    expect(employmentDates(j({ startDate: "2021-06", current: true }))).toEqual({ start_date: "2021-06-01", end_date: null });
    expect(employmentDates(j({ startDate: "2021-06" }))).toEqual({ start_date: null, end_date: null });
  });
  it("falls back to the period as written", () => {
    expect(employmentDates(j({ period: "Jan 2019 - Present" }))).toEqual({ start_date: "2019-01-01", end_date: null });
    expect(employmentDates(j({ period: "08/2017 - 09/2018" }))).toEqual({ start_date: "2017-08-01", end_date: "2018-09-30" });
  });
  it("stores nothing when the dates contradict each other or are missing", () => {
    expect(employmentDates(j({ startDate: "2020-05", endDate: "2019-01" }))).toEqual({ start_date: null, end_date: null });
    expect(employmentDates(j({ period: "last summer" }))).toEqual({ start_date: null, end_date: null });
  });
});

describe("proRowsFrom", () => {
  it("keeps headline, about and location, and one employment row per job with its dates", () => {
    const x = ProResumeSchema.parse({ isResume: true, personal: { location: " Pune " }, summary: { headline: "Data Analyst", about: "Reports  and   dashboards." }, experience: [{ title: "Analyst", organisation: "Metallco", startDate: "2017-08", endDate: "2018-09", period: "08/2017 - 09/2018", description: "Built reports" }] });
    expect(proRowsFrom(x)).toEqual({ profile: { headline: "Data Analyst", about: "Reports and dashboards.", location: "Pune" }, employment: [{ employer_name: "Metallco", job_title: "Analyst", period_text: "08/2017 - 09/2018", description: "Built reports", start_date: "2017-08-01", end_date: "2018-09-30" }] });
  });
  it("never leaves a required column blank", () => {
    const x = ProResumeSchema.parse({ isResume: true, experience: [{ title: "Consultant", organisation: null }] });
    expect(proRowsFrom(x).employment[0].employer_name).toBe("Employer not stated");
  });
  it("is empty for a resume with nothing in it", () => expect(proRowsFrom(ProResumeSchema.parse({ isResume: true })).employment).toEqual([]));
});
