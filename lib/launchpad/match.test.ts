import { describe, expect, it } from "vitest";
import { JOB_READY_LEVEL, matchJob } from "./match";

const ids: Record<string, string> = { sql: "s1", excel: "s2", statistics: "s3", "power bi": "s4" };
const resolve = (text: string) => ids[text.trim().toLowerCase()] ?? null;
const levels = new Map<string, number | null>([["s1", 87], ["s2", 30], ["s3", null]]);
const levelOf = (id: string) => levels.get(id) ?? null;

describe("matchJob", () => {
  it("averages how much of the job-ready level each skill reaches, capped at 100%", () => {
    const m = matchJob(["SQL", "Excel"], resolve, levelOf);
    expect(JOB_READY_LEVEL).toBe(60);
    expect(m.percent).toBe(Math.round((100 * (1 + 30 / 60)) / 2));
    expect(m.skills.map((s) => s.state)).toEqual(["met", "building"]);
  });

  it("treats a skill nobody has measured as zero coverage but says it is unmeasured, never as a low score", () => {
    const m = matchJob(["SQL", "Statistics"], resolve, levelOf);
    expect(m.percent).toBe(50);
    expect(m.measured).toBe(1);
    expect(m.skills[1]).toMatchObject({ state: "unmeasured", level: null });
  });

  it("leaves skills it cannot map to the catalog out of the percentage, and reports them", () => {
    const m = matchJob(["SQL", "Quantum basket weaving"], resolve, levelOf);
    expect(m.percent).toBe(100);
    expect(m.counted).toBe(1);
    expect(m.total).toBe(2);
    expect(m.skills[1]).toMatchObject({ state: "unmapped", skillId: null });
  });

  it("has no percentage when nothing in the job can be compared, or nothing is measured", () => {
    expect(matchJob(["Quantum basket weaving"], resolve, levelOf).percent).toBeNull();
    expect(matchJob([], resolve, levelOf).percent).toBeNull();
    const none = matchJob(["Statistics", "Power BI"], resolve, levelOf);
    expect(none.measured).toBe(0);
  });

  it("lists the gaps, weakest first, and not the skills already met", () => {
    const m = matchJob(["SQL", "Excel", "Statistics"], resolve, levelOf);
    expect(m.gaps.map((g) => g.text)).toEqual(["Statistics", "Excel"]);
  });

  it("counts each skill once even if the job repeats it", () => {
    const m = matchJob(["SQL", "sql", " SQL "], resolve, levelOf);
    expect(m.total).toBe(1);
    expect(m.percent).toBe(100);
  });
});
