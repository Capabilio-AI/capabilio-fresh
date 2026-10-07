import { describe, expect, it } from "vitest";
import { buildMilestones, horizonOfCourse, horizonOfSkill, laterOf } from "./milestones";
import type { GapRow, SubjectRow } from "./types";

const pos = { year: 3, semester: 1 as const, totalYears: 4 };
const gap = (skillId: string, over: Partial<GapRow> = {}): GapRow => ({
  skillId, skillName: skillId.toUpperCase(), importance: "HIGH", targetLevel: 80, stage: "JOB_READY", parentSkillId: null, currentLevel: 20, assessed: true, confidence: 0.7, verified: true, selfDeclaredOnly: false,
  gap: 60, met: false, coverage: "NONE", coverageCourseIds: [], coverageOutcomeCount: 0, gapType: "NOT_COVERED", ...over,
});
const subject = (courseId: string, year: number, semester: number | null, schedule: SubjectRow["schedule"]): SubjectRow => ({ courseId, title: `Course ${courseId}`, year, semester, score: 1, tier: "HIGH", stars: 4, schedule, facts: { skillIds: [], skillNames: [], outcomeCount: 0, gapPoints: 0 } });
const build = (over: Partial<Parameters<typeof buildMilestones>[0]> = {}) => buildMilestones({ gaps: [], subjects: [], certifications: [], projects: [], position: pos, ...over });

describe("horizons", () => {
  it("places courses by term: this semester NOW, the next NEXT, the rest of the year THIS_YEAR, next year NEXT_YEAR, later LONG_TERM", () => {
    expect(horizonOfCourse({ year: 3, semester: 1 }, pos)).toBe("NOW");
    expect(horizonOfCourse({ year: 3, semester: 2 }, pos)).toBe("NEXT");
    expect(horizonOfCourse({ year: 4, semester: 1 }, pos)).toBe("NEXT_YEAR");
    expect(horizonOfCourse({ year: 6, semester: 1 }, pos)).toBe("LONG_TERM");
    expect(horizonOfCourse({ year: 2, semester: 1 }, pos)).toBeNull(); // already behind them
    expect(horizonOfCourse({ year: 3, semester: 2 }, { ...pos, semester: 2 })).toBe("NOW");
    expect(horizonOfCourse({ year: 4, semester: 1 }, { ...pos, semester: 2 })).toBe("NEXT");
  });
  it("places skills by stage and by how much time is left in the program", () => {
    expect(horizonOfSkill("FOUNDATION", pos)).toBe("NOW");
    expect(horizonOfSkill("INTERMEDIATE", pos)).toBe("NEXT");
    expect(horizonOfSkill("JOB_READY", pos)).toBe("NEXT_YEAR");
    expect(horizonOfSkill("JOB_READY", { ...pos, year: 4 })).toBe("THIS_YEAR");
    expect(horizonOfSkill("JOB_READY", { ...pos, year: 1 })).toBe("LONG_TERM");
  });
  it("laterOf keeps the later of two horizons", () => {
    expect(laterOf("NOW", "NEXT_YEAR")).toBe("NEXT_YEAR");
    expect(laterOf("LONG_TERM", "NEXT")).toBe("LONG_TERM");
  });
});

describe("buildMilestones", () => {
  it("makes course milestones with honest statuses, and skips courses already behind the student", () => {
    const ms = build({ subjects: [subject("now", 3, 1, "CURRENT"), subject("next", 3, 2, "UPCOMING"), subject("old", 2, 2, "PAST")] });
    expect(ms.map((m) => [m.refId, m.horizon, m.status])).toEqual([["now", "NOW", "IN_PROGRESS"], ["next", "NEXT", "NOT_STARTED"]]);
  });
  it("makes a milestone for each required skill: met ones COMPLETED, started ones IN_PROGRESS, untouched ones NOT_STARTED", () => {
    const ms = build({ gaps: [gap("done", { met: true, gap: 0, currentLevel: 80, gapType: null }), gap("started", { currentLevel: 30 }), gap("fresh", { currentLevel: 0 })] }).filter((m) => m.kind === "SKILL");
    expect(Object.fromEntries(ms.map((m) => [m.refId, m.status]))).toEqual({ done: "COMPLETED", started: "IN_PROGRESS", fresh: "NOT_STARTED" });
  });
  it("never schedules an advanced skill before its prerequisite: it is BLOCKED, flagged optional exploration, and placed after the parent", () => {
    const ms = build({
      gaps: [
        gap("algo", { stage: "FOUNDATION", currentLevel: 10, targetLevel: 80 }),
        gap("graphs", { stage: "FOUNDATION", parentSkillId: "algo", currentLevel: 0, targetLevel: 70 }),
      ],
    });
    const parent = ms.find((m) => m.refId === "algo")!;
    const child = ms.find((m) => m.refId === "graphs")!;
    expect(parent).toMatchObject({ horizon: "NOW", status: "IN_PROGRESS" });
    expect(child).toMatchObject({ status: "BLOCKED", optionalExploration: true, blockedBySkillId: "algo" });
    expect(child.horizon).toBe("NEXT"); // one step after the parent
    expect(child.reason).toMatch(/ALGO/);
  });
  it("does not block when the prerequisite is already met or is not something this career requires", () => {
    const met = build({ gaps: [gap("algo", { met: true, gap: 0, currentLevel: 80, gapType: null }), gap("graphs", { parentSkillId: "algo" })] }).find((m) => m.refId === "graphs")!;
    expect(met.status).not.toBe("BLOCKED");
    const notRequired = build({ gaps: [gap("graphs", { parentSkillId: "algo" })] }).find((m) => m.refId === "graphs")!;
    expect(notRequired.status).not.toBe("BLOCKED");
    const partly = build({ gaps: [gap("algo", { currentLevel: 50, targetLevel: 80 }), gap("graphs", { parentSkillId: "algo" })] }).find((m) => m.refId === "graphs")!;
    expect(partly.status).not.toBe("BLOCKED"); // more than half-way through the parent is enough to begin
  });
  it("adds certification and project milestones by how much the career needs them", () => {
    const ms = build({
      certifications: [{ certId: "c1", name: "Req", relevance: "REQUIRED" }, { certId: "c2", name: "Opt", relevance: "OPTIONAL" }],
      projects: [{ projectId: "p1", title: "Build it" }],
    });
    expect(ms.find((m) => m.refId === "c1")).toMatchObject({ kind: "CERTIFICATION", horizon: "NEXT" });
    expect(ms.find((m) => m.refId === "c2")).toMatchObject({ horizon: "LONG_TERM" });
    expect(ms.find((m) => m.refId === "p1")).toMatchObject({ kind: "PROJECT", horizon: "NEXT" });
  });
  it("is ordered by horizon, then by importance, and deterministic", () => {
    const a = build({ gaps: [gap("late", { stage: "JOB_READY" }), gap("early", { stage: "FOUNDATION" })], subjects: [subject("c", 3, 1, "CURRENT")] });
    expect(a.map((m) => m.horizon)).toEqual(["NOW", "NOW", "NEXT_YEAR"]);
    expect(build({ gaps: [gap("early", { stage: "FOUNDATION" }), gap("late", { stage: "JOB_READY" })], subjects: [subject("c", 3, 1, "CURRENT")] })).toEqual(a);
  });
});
