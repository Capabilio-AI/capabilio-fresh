import { describe, expect, it } from "vitest";
import { courseRelevance, rankCareersForCourse, rankCoursesForCareer, RELEVANCE_THRESHOLDS, type Requirement } from "./relevance";

const req = (skillId: string, importance: Requirement["importance"], targetLevel = 100): Requirement => ({ skillId, importance, targetLevel });
const CAREER: Requirement[] = [req("sql", "CRITICAL", 80), req("stats", "HIGH", 70), req("py", "MEDIUM", 60), req("comm", "LOW", 50)];

describe("courseRelevance", () => {
  it("is NONE with no confirmed skills, no requirements, or no overlap — never invented", () => {
    expect(courseRelevance([], CAREER)).toMatchObject({ label: "NONE", score: 0, matches: [] });
    expect(courseRelevance([{ skillId: "sql", importance: "CORE" }], [])).toMatchObject({ label: "NONE", score: 0 });
    expect(courseRelevance([{ skillId: "cooking", importance: "CORE" }], CAREER)).toMatchObject({ label: "NONE", matches: [] });
  });
  it("a course that builds everything a career needs, at CORE, scores 1 and is HIGH", () => {
    const all = CAREER.map((r) => ({ skillId: r.skillId, importance: "CORE" as const }));
    const r = courseRelevance(all, CAREER);
    expect(r.score).toBeCloseTo(1, 10);
    expect(r.label).toBe("HIGH");
    expect(r.matches).toHaveLength(4);
  });
  it("covering a CRITICAL requirement counts for more than covering a LOW one", () => {
    const critical = courseRelevance([{ skillId: "sql", importance: "CORE" }], CAREER).score;
    const low = courseRelevance([{ skillId: "comm", importance: "CORE" }], CAREER).score;
    expect(critical).toBeGreaterThan(low * 3);
  });
  it("how strongly the course teaches the skill matters; an ungraded mapping counts as SUPPORTING", () => {
    const core = courseRelevance([{ skillId: "sql", importance: "CORE" }], CAREER).score;
    const supporting = courseRelevance([{ skillId: "sql", importance: "SUPPORTING" }], CAREER).score;
    const minor = courseRelevance([{ skillId: "sql", importance: "MINOR" }], CAREER).score;
    const ungraded = courseRelevance([{ skillId: "sql", importance: null }], CAREER).score;
    expect(core).toBeGreaterThan(supporting);
    expect(supporting).toBeGreaterThan(minor);
    expect(ungraded).toBe(supporting);
  });
  it("a higher target level makes a requirement count for more", () => {
    const hi = courseRelevance([{ skillId: "a", importance: "CORE" }], [req("a", "HIGH", 90), req("b", "HIGH", 30)]).score;
    const lo = courseRelevance([{ skillId: "b", importance: "CORE" }], [req("a", "HIGH", 90), req("b", "HIGH", 30)]).score;
    expect(hi).toBeGreaterThan(lo);
  });
  it("labels follow the documented thresholds", () => {
    const only = (skillId: string) => courseRelevance([{ skillId, importance: "CORE" }], CAREER);
    expect(only("sql").score).toBeGreaterThanOrEqual(RELEVANCE_THRESHOLDS.high); // the critical skill alone is a lot of the career
    expect(only("sql").label).toBe("HIGH");
    expect(only("comm").label).toBe("LOW");
    expect(courseRelevance([{ skillId: "py", importance: "CORE" }], CAREER).label).toBe("MEDIUM");
  });
  it("explains itself: matches name the skill, both importances and what they contributed, biggest first", () => {
    const r = courseRelevance([{ skillId: "py", importance: "CORE" }, { skillId: "sql", importance: "SUPPORTING" }], CAREER);
    expect(r.matches.map((m) => m.skillId)).toEqual(["sql", "py"]);
    expect(r.matches[0]).toMatchObject({ requirement: "CRITICAL", mapping: "SUPPORTING" });
    expect(r.matches[0].contribution).toBeGreaterThan(r.matches[1].contribution);
    expect(r.matches.reduce((s, m) => s + m.contribution, 0) / r.demand).toBeCloseTo(r.score, 10);
  });
  it("counts a skill once even if it is listed twice", () => {
    const once = courseRelevance([{ skillId: "sql", importance: "CORE" }], CAREER).score;
    expect(courseRelevance([{ skillId: "sql", importance: "MINOR" }, { skillId: "sql", importance: "CORE" }], CAREER).score).toBe(once);
  });
  it("is deterministic", () => {
    const a = courseRelevance([{ skillId: "sql", importance: "CORE" }, { skillId: "py", importance: null }], CAREER);
    expect(courseRelevance([{ skillId: "py", importance: null }, { skillId: "sql", importance: "CORE" }], CAREER)).toEqual(a);
  });
});

describe("ranking", () => {
  const careers = [{ id: "da", name: "Data Analyst", requirements: CAREER }, { id: "se", name: "Software Engineer", requirements: [req("dsa", "CRITICAL", 80)] }];
  it("ranks careers for a course, best first, ties by name", () => {
    const ranked = rankCareersForCourse([{ skillId: "sql", importance: "CORE" }], careers);
    expect(ranked.map((r) => [r.careerId, r.relevance.label])).toEqual([["da", "HIGH"], ["se", "NONE"]]);
  });
  it("ranks courses for a career", () => {
    const ranked = rankCoursesForCareer(CAREER, [{ id: "c1", skills: [{ skillId: "comm", importance: "CORE" }] }, { id: "c2", skills: [{ skillId: "sql", importance: "CORE" }] }]);
    expect(ranked.map((r) => r.courseId)).toEqual(["c2", "c1"]);
  });
});
