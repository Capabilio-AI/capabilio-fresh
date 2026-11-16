import { describe, expect, it } from "vitest";
import { periodOf, workFromRows, type ProEmploymentRow } from "./work";

const row = (id: string, org: string, over: Partial<ProEmploymentRow> = {}): ProEmploymentRow => ({ id, employer_name: org, job_title: "Dev", start_date: null, end_date: null, period_text: null, description: null, source: "entered", ...over });

describe("periodOf", () => {
  it("reads like a person and says when there are no dates", () => {
    expect(periodOf("2023-08-01", null)).toBe("Aug 2023 to present");
    expect(periodOf("2019-01-15", "2022-03-31")).toBe("Jan 2019 to Mar 2022");
    expect(periodOf(null, null)).toBe("Dates not added");
  });
});

describe("workFromRows", () => {
  it("puts the current job first, then dated jobs newest first, then resume-only wording", () => {
    const w = workFromRows([
      row("old", "Old Co", { start_date: "2015-01-01", end_date: "2018-01-01" }),
      row("text", "Resume Co", { source: "resume", period_text: "2017 - 2018" }),
      row("now", "Now Co", { start_date: "2021-01-01" }),
      row("mid", "Mid Co", { start_date: "2018-02-01", end_date: "2020-12-01" }),
    ]);
    expect(w.map((x) => x.id)).toEqual(["now", "mid", "old", "text"]);
    expect(w[0].current).toBe(true);
    expect(w[3].period).toBe("2017 - 2018");
  });
  it("calls a resume job current only when it has a start date and no end, never when it is only wording", () => {
    expect(workFromRows([row("r", "X", { source: "resume", start_date: "2020-01-01" })])[0].current).toBe(true);
    expect(workFromRows([row("t", "X", { source: "resume", period_text: "2017 - 2018" })])[0].current).toBe(false);
  });
  it("is empty with nothing at all", () => expect(workFromRows([])).toEqual([]));
});
