import { describe, expect, it } from "vitest";
import { matchJob } from "./match";

const names = new Map([["sql", "SQL"], ["py", "Python"], ["pbi", "Power BI"]]);
describe("matchJob", () => {
  it("counts the skills a student already shows and names the rest", () => {
    const m = matchJob({ skillIds: ["sql", "py", "pbi"] }, new Map([["sql", 70], ["py", 49], ["pbi", null]]), names);
    expect(m).toEqual({ have: 1, total: 3, percent: 33, missing: ["Python", "Power BI"] });
  });
  it("treats an unmeasured skill as not yet shown", () => {
    expect(matchJob({ skillIds: ["sql"] }, new Map(), names).percent).toBe(0);
  });
  it("makes no claim when the posting named no known skill", () => {
    expect(matchJob({ skillIds: [] }, new Map(), names)).toEqual({ have: 0, total: 0, percent: null, missing: [] });
  });
});
