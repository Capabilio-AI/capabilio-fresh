import { describe, expect, it } from "vitest";
import { MANDATORY_NOTE, prioritiseSubjects, scheduleOf } from "./subjects";
import type { CourseInput, GapRow } from "./types";

const gap = (skillId: string, importance: GapRow["importance"], g: number, over: Partial<GapRow> = {}): GapRow => ({
  skillId, skillName: skillId.toUpperCase(), importance, targetLevel: 80, stage: "JOB_READY", parentSkillId: null, currentLevel: 80 - g, assessed: true, confidence: 0.7, verified: true, selfDeclaredOnly: false,
  gap: g, met: g === 0, coverage: "NONE", coverageCourseIds: [], coverageOutcomeCount: 0, gapType: g === 0 ? null : "NOT_COVERED", ...over,
});
const course = (id: string, skills: CourseInput["skills"], year = 3, semester: number | null = 1): CourseInput => ({ id, title: `Course ${id}`, year, semester, skills, prerequisiteCourseIds: [] });
const s = (skillId: string, importance: "CORE" | "SUPPORTING" | "MINOR" | null = "CORE", outcomeCount = 0) => ({ skillId, importance, outcomeCount });
const pos = { year: 3, semester: 1 as const, totalYears: 4 };

describe("scheduleOf", () => {
  it("places a course relative to the student's year and semester", () => {
    expect(scheduleOf({ year: 2, semester: 2 }, pos)).toBe("PAST");
    expect(scheduleOf({ year: 3, semester: 1 }, pos)).toBe("CURRENT");
    expect(scheduleOf({ year: 3, semester: 2 }, pos)).toBe("UPCOMING");
    expect(scheduleOf({ year: 4, semester: 1 }, pos)).toBe("UPCOMING");
    expect(scheduleOf({ year: 5, semester: 1 }, pos)).toBe("FUTURE");
  });
  it("with no semester stated, goes by year alone", () => {
    expect(scheduleOf({ year: 2, semester: null }, pos)).toBe("PAST");
    expect(scheduleOf({ year: 3, semester: null }, pos)).toBe("CURRENT");
    expect(scheduleOf({ year: 4, semester: null }, pos)).toBe("UPCOMING");
  });
});

describe("prioritiseSubjects", () => {
  const gaps = [gap("sql", "CRITICAL", 60), gap("py", "HIGH", 40), gap("comm", "LOW", 30), gap("done", "CRITICAL", 0)];
  it("scores each course by (career importance × how big the gap is × how strongly it teaches the skill) and ranks them", () => {
    const rows = prioritiseSubjects([course("db", [s("sql")]), course("py", [s("py")]), course("soft", [s("comm")])], gaps, pos);
    expect(rows.map((r) => r.courseId)).toEqual(["db", "py", "soft"]);
    expect(rows[0].score).toBeCloseTo(4 * 0.6 * 1, 10);
    expect(rows[0].tier).toBe("CRITICAL");
    expect(rows[0].stars).toBe(5);
    expect(rows[2].tier).toBe("USEFUL");
    expect(rows[2].stars).toBeGreaterThanOrEqual(1);
  });
  it("a bigger gap, a more important requirement, or a stronger mapping each raise the score", () => {
    const bigGap = prioritiseSubjects([course("x", [s("sql")])], [gap("sql", "HIGH", 70)], pos)[0].score;
    const smallGap = prioritiseSubjects([course("x", [s("sql")])], [gap("sql", "HIGH", 20)], pos)[0].score;
    expect(bigGap).toBeGreaterThan(smallGap);
    const core = prioritiseSubjects([course("x", [s("sql", "CORE")])], gaps, pos)[0].score;
    const minor = prioritiseSubjects([course("x", [s("sql", "MINOR")])], gaps, pos)[0].score;
    expect(core).toBeGreaterThan(minor);
  });
  it("leaves out courses that build nothing the career still needs (met skills and unrelated skills score 0)", () => {
    expect(prioritiseSubjects([course("a", [s("done")]), course("b", [s("unrelated")]), course("c", [])], gaps, pos)).toEqual([]);
  });
  it("never lists anything but the facts it was built from", () => {
    const [r] = prioritiseSubjects([course("db", [s("sql", "CORE", 2), s("py", "SUPPORTING", 1), s("done", "CORE", 5)])], gaps, pos);
    expect(r.facts.skillIds.sort()).toEqual(["py", "sql"]); // the met skill is not a reason to focus on it
    expect(r.facts.outcomeCount).toBe(3);
    expect(r.facts.gapPoints).toBe(100);
    expect(r.facts.skillNames[0]).toBe("SQL"); // biggest contribution first
  });
  it("keeps earlier-year courses visible but marked PAST, and carries the schedule", () => {
    const [r] = prioritiseSubjects([course("old", [s("sql")], 2, 1)], gaps, pos);
    expect(r.schedule).toBe("PAST");
  });
  it("is deterministic and the mandatory note never tells a student to skip anything", () => {
    const a = prioritiseSubjects([course("a", [s("sql")]), course("b", [s("py")])], gaps, pos);
    expect(prioritiseSubjects([course("b", [s("py")]), course("a", [s("sql")])], gaps, pos)).toEqual(a);
    expect(MANDATORY_NOTE).toMatch(/All university subjects remain part of your academic curriculum/);
    expect(MANDATORY_NOTE).toMatch(/prioritized because they contribute more directly to your target career/);
    expect(MANDATORY_NOTE).not.toMatch(/\b(skip|ignore)\b/i);
  });
});
