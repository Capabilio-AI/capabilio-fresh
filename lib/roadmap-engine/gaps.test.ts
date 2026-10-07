import { describe, expect, it } from "vitest";
import { analyseGaps, classifyCoverage, effectiveLevel, gapTypeFor } from "./gaps";
import type { CareerRequirement, CourseInput, EngineInput, StudentSkillInput } from "./types";

const req = (skillId: string, importance: CareerRequirement["importance"], targetLevel: number, stage: CareerRequirement["stage"] = "JOB_READY"): CareerRequirement => ({ skillId, skillName: skillId.toUpperCase(), importance, targetLevel, stage, parentSkillId: null });
const course = (id: string, skills: CourseInput["skills"]): CourseInput => ({ id, title: id, year: 2, semester: 1, skills, prerequisiteCourseIds: [] });
const cs = (skillId: string, importance: "CORE" | "SUPPORTING" | "MINOR" | null = "SUPPORTING", outcomeCount = 0) => ({ skillId, importance, outcomeCount });
const verified = (level: number, confidence = 0.7): StudentSkillInput => ({ level, assessed: true, confidence, verified: true, verifiedLevel: level, selfDeclaredLevel: null });
const claimed = (selfLevel: number): StudentSkillInput => ({ level: Math.min(40, selfLevel), assessed: true, confidence: 0, verified: false, verifiedLevel: null, selfDeclaredLevel: Math.min(40, selfLevel) });
const empty = { learning: [], certifications: [], projects: [], arena: [] };

describe("effectiveLevel", () => {
  it("is the verified level; a self-declared claim counts for half and never beats verified", () => {
    expect(effectiveLevel(verified(70))).toBe(70);
    expect(effectiveLevel(claimed(80))).toBe(20); // capped at 40, then halved
    expect(effectiveLevel({ level: 30, assessed: true, confidence: 0.5, verified: true, verifiedLevel: 30, selfDeclaredLevel: 40 })).toBe(30);
    expect(effectiveLevel(undefined)).toBe(0);
  });
});

describe("classifyCoverage", () => {
  it("NONE when no confirmed course teaches the skill", () => {
    expect(classifyCoverage("sql", [course("c", [cs("py")])])).toMatchObject({ coverage: "NONE", courseIds: [], outcomeCount: 0 });
  });
  it("STRONG: a course that teaches it as CORE, or several courses, or several outcomes", () => {
    expect(classifyCoverage("sql", [course("c", [cs("sql", "CORE")])]).coverage).toBe("STRONG");
    expect(classifyCoverage("sql", [course("a", [cs("sql", "SUPPORTING")]), course("b", [cs("sql", "SUPPORTING")])]).coverage).toBe("STRONG");
    expect(classifyCoverage("sql", [course("a", [cs("sql", "SUPPORTING", 3)])]).coverage).toBe("STRONG");
  });
  it("PARTIAL: one course that only supports or lightly touches it", () => {
    expect(classifyCoverage("sql", [course("a", [cs("sql", "SUPPORTING", 1)])]).coverage).toBe("PARTIAL");
    expect(classifyCoverage("sql", [course("a", [cs("sql", "MINOR")]), course("b", [cs("sql", "MINOR")])]).coverage).toBe("PARTIAL"); // two MINOR touches are still light
    expect(classifyCoverage("sql", [course("a", [cs("sql", null)])]).coverage).toBe("PARTIAL"); // ungraded = SUPPORTING, one course
  });
  it("lists which courses cover it and how many outcomes", () => {
    const r = classifyCoverage("sql", [course("a", [cs("sql", "CORE", 2)]), course("b", [cs("py")]), course("c", [cs("sql", "MINOR", 1)])]);
    expect(r.courseIds.sort()).toEqual(["a", "c"]);
    expect(r.outcomeCount).toBe(3);
  });
});

describe("gapTypeFor", () => {
  it("follows the curriculum when it covers the skill", () => {
    expect(gapTypeFor("STRONG", true, true)).toBe("COVERED_BY_CURRICULUM");
    expect(gapTypeFor("PARTIAL", false, false)).toBe("PARTIALLY_COVERED");
  });
  it("when the curriculum has nothing: external learning if configured, else practice, else just not covered", () => {
    expect(gapTypeFor("NONE", true, true)).toBe("NEEDS_EXTERNAL_LEARNING");
    expect(gapTypeFor("NONE", false, true)).toBe("NEEDS_PRACTICAL_EXPERIENCE");
    expect(gapTypeFor("NONE", false, false)).toBe("NOT_COVERED");
  });
});

describe("analyseGaps", () => {
  const input = (over: Partial<EngineInput> = {}) => ({ requirements: [req("sql", "CRITICAL", 80), req("py", "HIGH", 60), req("stats", "LOW", 50)], courses: [course("dbms", [cs("sql", "CORE", 2)])], capability: { sql: verified(38) } as Record<string, StudentSkillInput>, catalogs: empty, ...over });
  it("computes gap = max(0, target - current), flags met skills and never reports a negative gap", () => {
    const rows = analyseGaps(input({ capability: { sql: verified(90), py: verified(20) } }));
    const by = (id: string) => rows.find((r) => r.skillId === id)!;
    expect(by("sql")).toMatchObject({ currentLevel: 90, gap: 0, met: true, gapType: null });
    expect(by("py")).toMatchObject({ currentLevel: 20, gap: 40, met: false });
    expect(by("stats")).toMatchObject({ currentLevel: 0, gap: 50, met: false }); // no evidence: 0, not a guess
  });
  it("classifies coverage and gap type per skill", () => {
    const rows = analyseGaps(input());
    expect(rows.find((r) => r.skillId === "sql")).toMatchObject({ coverage: "STRONG", gapType: "COVERED_BY_CURRICULUM", coverageCourseIds: ["dbms"] });
    expect(rows.find((r) => r.skillId === "py")).toMatchObject({ coverage: "NONE", gapType: "NOT_COVERED" });
  });
  it("uses what the catalogs actually offer to say how an uncovered gap can be closed", () => {
    const learning = [{ id: "l", title: "L", provider: "P", url: null, levelFrom: 0, levelTo: 70, estimatedHours: 5, prerequisites: [], skillIds: ["py"] }];
    const arena = [{ id: "a", title: "A", difficulty: "easy", skillIds: ["stats"], active: true }];
    const rows = analyseGaps(input({ catalogs: { ...empty, learning, arena } }));
    expect(rows.find((r) => r.skillId === "py")!.gapType).toBe("NEEDS_EXTERNAL_LEARNING");
    expect(rows.find((r) => r.skillId === "stats")!.gapType).toBe("NEEDS_PRACTICAL_EXPERIENCE");
  });
  it("keeps verified and self-declared apart: a claim alone is flagged and counts for half", () => {
    const row = analyseGaps(input({ capability: { py: claimed(80) } })).find((r) => r.skillId === "py")!;
    expect(row).toMatchObject({ selfDeclaredOnly: true, verified: false, currentLevel: 20, gap: 40 });
  });
  it("orders by importance then bigger gap, so the list reads most-important first", () => {
    expect(analyseGaps(input()).map((r) => r.skillId)).toEqual(["sql", "py", "stats"]);
  });
});
