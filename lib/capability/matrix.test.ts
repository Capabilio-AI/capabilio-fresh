import { describe, expect, it } from "vitest";
import { buildSkillMatrix, levelLabel } from "./matrix";

const cap = (level: number | null, extra: Partial<{ verified: boolean; confidence: number; evidenceCount: number }> = {}) => ({ level, verified: false, confidence: 0.5, evidenceCount: 1, ...extra });

describe("levelLabel", () => {
  it("names bands, and never calls a missing measurement a level", () => {
    expect([null, 0, 24, 25, 49, 50, 74, 75, 100].map(levelLabel)).toEqual(["Not assessed", "Beginner", "Beginner", "Developing", "Developing", "Proficient", "Proficient", "Advanced", "Advanced"]);
  });
});

describe("buildSkillMatrix", () => {
  const names = new Map([["sql", "SQL"], ["xl", "Excel"], ["stat", "Statistics"], ["bi", "Power BI"], ["py", "Python"]]);

  it("lists measured skills first, strongest first, then skills the user has not been measured on", () => {
    const rows = buildSkillMatrix({
      capabilities: new Map([["sql", cap(82, { verified: true })], ["xl", cap(40)]]),
      arenaPasses: new Map([["sql", 3]]),
      names,
      practisable: new Map([["stat", { areaKey: "statistics", areaName: "Statistics" }]]),
      targets: new Map([["bi", 60]]),
    });
    expect(rows.map((r) => r.name)).toEqual(["SQL", "Excel", "Power BI", "Statistics"]);
    expect(rows[0]).toMatchObject({ level: 82, label: "Advanced", verified: true, arenaPasses: 3 });
    expect(rows[2]).toMatchObject({ level: null, label: "Not assessed", target: 60 });
    expect(rows[3].practise).toEqual({ areaKey: "statistics", areaName: "Statistics" });
  });

  it("reports how far a measured skill is from its target, and zero when it is met", () => {
    const rows = buildSkillMatrix({ capabilities: new Map([["sql", cap(50)], ["xl", cap(70)]]), arenaPasses: new Map(), names, practisable: new Map(), targets: new Map([["sql", 70], ["xl", 60]]) });
    expect(rows.find((r) => r.name === "SQL")!.gap).toBe(20);
    expect(rows.find((r) => r.name === "Excel")!.gap).toBe(0);
  });

  it("leaves out a skill whose name is unknown and respects the limit", () => {
    const rows = buildSkillMatrix({ capabilities: new Map([["ghost", cap(90)], ["sql", cap(80)], ["xl", cap(70)], ["stat", cap(60)]]), arenaPasses: new Map(), names, practisable: new Map(), targets: new Map(), limit: 2 });
    expect(rows.map((r) => r.name)).toEqual(["SQL", "Excel"]);
  });

  it("shows only the target role's skills when asked, however much else the user has measured", () => {
    const rows = buildSkillMatrix({
      capabilities: new Map([["sql", cap(82)], ["xl", cap(40)], ["py", cap(30)]]),
      arenaPasses: new Map(),
      names,
      practisable: new Map([["stat", { areaKey: "statistics", areaName: "Statistics" }]]),
      targets: new Map([["py", 60]]),
      only: new Set(["py", "bi"]),
    });
    expect(rows.map((r) => r.name)).toEqual(["Python", "Power BI"]);
    expect(rows[1]).toMatchObject({ level: null, label: "Not assessed" });
  });

  it("is empty when there is nothing to show", () => {
    expect(buildSkillMatrix({ capabilities: new Map(), arenaPasses: new Map(), names, practisable: new Map(), targets: new Map() })).toEqual([]);
  });
});
