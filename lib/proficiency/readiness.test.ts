import { describe, expect, it } from "vitest";
import { assessRoleReadiness, type Requirement } from "./readiness";

const reqs: Requirement[] = [
  { skillId: "sql", name: "SQL", importance: "CRITICAL" },
  { skillId: "da", name: "Data Analysis", importance: "CRITICAL" },
  { skillId: "xl", name: "Excel", importance: "HIGH" },
  { skillId: "bi", name: "Power BI", importance: "HIGH" },
  { skillId: "py", name: "Python", importance: "MEDIUM" },
  { skillId: "ps", name: "Presentation", importance: "LOW" },
];
const at = (levels: Record<string, number>) => assessRoleReadiness(reqs, levels, {}, "Data Analyst");

describe("student role readiness", () => {
  it("is Not started when nothing has been demonstrated", () => {
    const r = at({});
    expect(r.state).toBe("not_started");
    expect(r.why).toMatch(/No graded work/);
    expect(r.progressPct).toBe(0);
  });

  it("is Learning while progress is small, even with one skill at level 1", () => {
    expect(at({ sql: 1 }).state).toBe("learning");
  });

  it("is Developing once there is real progress but a critical skill is unmet", () => {
    const r = at({ sql: 3, da: 2, xl: 2, bi: 1, py: 1 });
    expect(r.state).toBe("developing");
    expect(r.gaps[0].skillName).toBe("Data Analysis");
  });

  it("is Demonstrated when every critical skill is met but a high one is not", () => {
    const r = at({ sql: 3, da: 3, xl: 3, bi: 1 });
    expect(r.state).toBe("demonstrated");
    expect(r.gaps.map((g) => g.skillName)).toContain("Power BI");
  });

  it("is Ready for role assessment only when every critical and high skill is met and most of the rest", () => {
    const r = at({ sql: 3, da: 3, xl: 3, bi: 3, py: 2, ps: 0 });
    expect(r.state).toBe("ready_for_assessment");
    expect(r.why).toMatch(/not a job guarantee/);
  });

  it("does not let strength in minor skills stand in for a missing core skill", () => {
    const r = at({ sql: 3, da: 3, xl: 3, bi: 0, py: 5, ps: 5 });
    expect(r.state).toBe("demonstrated");
  });

  it("does not count a level above the target as extra progress toward another skill", () => {
    const high = at({ sql: 5, da: 0 });
    const exact = at({ sql: 3, da: 0 });
    expect(high.progressPct).toBe(exact.progressPct);
  });

  it("orders gaps by importance, then by how close the student is, and carries the next steps", () => {
    const r = assessRoleReadiness(reqs, { sql: 3, da: 3, xl: 1, bi: 2 }, { bi: ["1 explained in the interview"], xl: ["4 verified tasks passed"] }, "Data Analyst");
    expect(r.gaps.map((g) => g.skillName)).toEqual(["Power BI", "Excel", "Python", "Presentation"]);
    expect(r.gaps[0].nextSteps).toEqual(["1 explained in the interview"]);
  });

  it("copes with a role that has no requirements instead of claiming readiness", () => {
    const r = assessRoleReadiness([], { sql: 3 });
    expect(r.state).toBe("not_started");
    expect(r.total).toBe(0);
  });
});
