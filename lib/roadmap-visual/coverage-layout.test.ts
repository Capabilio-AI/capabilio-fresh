import { describe, expect, it } from "vitest";
import { classifyCoverage, dataSufficient, subjectPriorities, timingOf, type CurriculumCourse } from "./coverage";
import { GROUP_W, SPINE_W, TOPIC_W, layoutRoadmap, type LayoutInput } from "./layout";

const course = (id: string, over: Partial<CurriculumCourse> = {}): CurriculumCourse => ({ id, title: `Course ${id}`, code: id.toUpperCase(), year: 2, semester: 1, pages: { start: 10, end: 12 }, analysed: true, units: [{ id: `${id}u1`, no: 1, title: "Unit one" }, { id: `${id}u2`, no: 2, title: "Unit two" }], outcomes: [{ id: `${id}o1`, code: "CO1", text: "Do the thing", source: "EXTRACTED" }], links: [], ...over });
const pos = { year: 2, semester: 2 };
const link = (over: Record<string, unknown> = {}) => ({ skillId: "sql", tier: "OFFICIAL" as const, confidence: 0.9, level: "COURSE" as const, importance: null, ...over });

describe("timingOf", () => {
  it("compares year, then semester when both are known", () => {
    expect(timingOf({ year: 1, semester: 2 }, pos)).toBe("COMPLETED");
    expect(timingOf({ year: 2, semester: 1 }, pos)).toBe("COMPLETED");
    expect(timingOf({ year: 2, semester: 2 }, pos)).toBe("CURRENT");
    expect(timingOf({ year: 2, semester: null }, pos)).toBe("CURRENT");
    expect(timingOf({ year: 3, semester: 1 }, pos)).toBe("UPCOMING");
  });
  it("is unknown when the student's year is unknown", () => expect(timingOf({ year: 2, semester: 1 }, { year: null, semester: null })).toBe("UNKNOWN"));
});

describe("classifyCoverage", () => {
  it("is UNKNOWN, never NONE, when there is no curriculum or too little of it was analysed", () => {
    expect(classifyCoverage("sql", null, pos, 0.8)).toMatchObject({ state: "UNKNOWN", unknownReason: "NO_CURRICULUM" });
    expect(classifyCoverage("sql", [], pos, 0.8)).toMatchObject({ state: "UNKNOWN", unknownReason: "NO_CURRICULUM" });
    const unanalysed = [course("a", { analysed: false }), course("b", { analysed: false }), course("c", { analysed: true })];
    expect(classifyCoverage("sql", unanalysed, pos, 0.8)).toMatchObject({ state: "UNKNOWN", unknownReason: "NOT_ENOUGH_ANALYSED" });
  });
  it("is NONE only when enough of the syllabus was analysed and nothing teaches the skill", () => {
    const analysed = [course("a"), course("b"), course("c")];
    expect(dataSufficient(analysed)).toBe(true);
    expect(classifyCoverage("sql", analysed, pos, 0.8)).toMatchObject({ state: "NONE", items: [], basis: null });
  });
  it("names the course, unit, outcome, semester, pages and timing behind a covered skill", () => {
    const c = course("dbms", { year: 2, semester: 1, links: [link({ level: "UNIT", unitId: "dbmsu1" }), link({ level: "OUTCOME", outcomeId: "dbmso1" })] });
    const r = classifyCoverage("sql", [c, course("x")], pos, 0.8);
    expect(r.state).toBe("PARTIAL"); // one course, two specific links: not yet "strong" (that needs a core link, a second course or three specific links)
    expect(r.basis).toBe("OFFICIAL");
    expect(r.items[0]).toMatchObject({ courseId: "dbms", timing: "COMPLETED", tier: "OFFICIAL", pages: { start: 10, end: 12 }, units: [{ no: 1, title: "Unit one" }], outcomes: [{ code: "CO1", source: "EXTRACTED" }] });
  });
  it("three specific unit/outcome links in one course make it STRONG", () => {
    const c = course("dbms", { links: [link({ level: "UNIT", unitId: "dbmsu1" }), link({ level: "UNIT", unitId: "dbmsu2" }), link({ level: "OUTCOME", outcomeId: "dbmso1" })] });
    expect(classifyCoverage("sql", [c, course("x"), course("y")], pos, 0.8).state).toBe("STRONG");
  });
  it("one light mention is PARTIAL; a core official link or several courses is STRONG", () => {
    expect(classifyCoverage("sql", [course("a", { links: [link()] }), course("b"), course("c")], pos, 0.8).state).toBe("PARTIAL");
    expect(classifyCoverage("sql", [course("a", { links: [link({ importance: "CORE" })] }), course("b"), course("c")], pos, 0.8).state).toBe("STRONG");
    expect(classifyCoverage("sql", [course("a", { links: [link()] }), course("b", { links: [link()] }), course("c")], pos, 0.8).state).toBe("STRONG");
  });
  it("shows an inferred link only above the confidence threshold, and labels it inferred", () => {
    const low = [course("a", { links: [link({ tier: "INFERRED", confidence: 0.7 })] }), course("b"), course("c")];
    expect(classifyCoverage("sql", low, pos, 0.8)).toMatchObject({ state: "NONE" });
    const high = [course("a", { links: [link({ tier: "INFERRED", confidence: 0.9 })] }), course("b"), course("c")];
    const r = classifyCoverage("sql", high, pos, 0.8);
    expect(r).toMatchObject({ state: "PARTIAL", basis: "INFERRED" });
    expect(r.items[0].tier).toBe("INFERRED");
  });
  it("reports MIXED when official and inferred links both support a skill, and never upgrades inferred to official", () => {
    const r = classifyCoverage("sql", [course("a", { links: [link()] }), course("b", { links: [link({ tier: "INFERRED" })] }), course("c")], pos, 0.8);
    expect(r.basis).toBe("MIXED");
    expect(r.items.map((i) => i.tier).sort()).toEqual(["INFERRED", "OFFICIAL"]);
  });
  it("orders the courses by year and semester", () => {
    const r = classifyCoverage("sql", [course("late", { year: 3, semester: 2, links: [link()] }), course("early", { year: 1, semester: 1, links: [link()] })], pos, 0.8);
    expect(r.items.map((i) => i.courseId)).toEqual(["early", "late"]);
  });
});

describe("subjectPriorities", () => {
  const topics = [
    { key: "t1", title: "SQL", skillId: "sql", importance: "CORE" as const, target: 80, level: 20 },
    { key: "t2", title: "Stats", skillId: "stats", importance: "OPTIONAL" as const, target: 70, level: 70 },
    { key: "t3", title: "Charts", skillId: "viz", importance: "RECOMMENDED" as const, target: 60, level: null },
  ];
  const courses = [course("dbms", { links: [link({ skillId: "sql" }), link({ skillId: "viz" })] }), course("prob", { links: [link({ skillId: "stats" })] }), course("other")];
  it("ranks subjects by importance-weighted remaining gap, counting an unassessed topic as fully open", () => {
    const r = subjectPriorities(courses, topics, pos, 0.8);
    expect(r.map((s) => s.courseId)).toEqual(["dbms", "prob"]);
    expect(r[0].score).toBe(3 * 0.75 + 2 * 1);
    expect(r[1].score).toBe(0); // the topic it feeds is already at target
    expect(r[0].topics.map((t) => t.nodeKey)).toEqual(["t1", "t3"]);
  });
});

describe("layoutRoadmap", () => {
  const nodes: LayoutInput[] = [
    { key: "s1", parentKey: null, type: "SPINE", side: "CENTER", order: 10 },
    { key: "s2", parentKey: null, type: "SPINE", side: "CENTER", order: 20 },
    { key: "gl", parentKey: "s1", type: "GROUP", side: "LEFT", order: 1 },
    { key: "gr", parentKey: "s1", type: "GROUP", side: "RIGHT", order: 1 },
    { key: "a", parentKey: "gl", type: "TOPIC", side: "LEFT", order: 1 },
    { key: "b", parentKey: "gl", type: "TOPIC", side: "LEFT", order: 2 },
    { key: "c", parentKey: "gr", type: "TOPIC", side: "RIGHT", order: 1 },
    { key: "g2", parentKey: "s2", type: "GROUP", side: "LEFT", order: 1 },
    { key: "d", parentKey: "g2", type: "TOPIC", side: "LEFT", order: 1 },
  ];
  const { boxes, bounds } = layoutRoadmap(nodes);
  it("stacks spine stages top to bottom without overlap, with the spine centred", () => {
    expect(boxes.s1.y + boxes.s1.h).toBeLessThan(boxes.s2.y);
    expect(boxes.s1.x + boxes.s1.w / 2).toBe(0);
  });
  it("puts sections beside the spine and their topics beyond them, left and right", () => {
    expect(boxes.gl.x + GROUP_W).toBeLessThan(boxes.s1.x);
    expect(boxes.a.x + TOPIC_W).toBeLessThan(boxes.gl.x);
    expect(boxes.gr.x).toBeGreaterThan(boxes.s1.x + SPINE_W);
    expect(boxes.c.x).toBeGreaterThan(boxes.gr.x + GROUP_W);
  });
  it("centres a section on its topics, keeps topics in order and never overlaps", () => {
    expect(boxes.a.y + boxes.a.h).toBeLessThan(boxes.b.y);
    const mid = (x: { y: number; h: number }) => x.y + x.h / 2;
    expect(mid(boxes.gl)).toBeCloseTo((boxes.a.y + boxes.b.y + boxes.b.h) / 2, 5);
    expect(boxes.b.y + boxes.b.h).toBeLessThan(boxes.d.y);
  });
  it("is deterministic and reports bounds that contain everything", () => {
    expect(layoutRoadmap(nodes)).toEqual({ boxes, bounds });
    for (const b of Object.values(boxes)) {
      expect(b.x).toBeGreaterThanOrEqual(bounds.x);
      expect(b.x + b.w).toBeLessThanOrEqual(bounds.x + bounds.w);
      expect(b.y + b.h).toBeLessThanOrEqual(bounds.h);
    }
  });
  it("handles an empty tree", () => expect(layoutRoadmap([])).toEqual({ boxes: {}, bounds: { x: 0, y: 0, w: 0, h: 0 } }));
});

import { inferredFromTitle, titleNamesSkill } from "./curriculum-overlay";
describe("title matching", () => {
  it("matches whole-word skill names in a subject title only", () => {
    expect(titleNamesSkill("Data Structures using C", "Data Structures")).toBe(true);
    expect(titleNamesSkill("Object Oriented Programming through Java", "Object-Oriented Programming")).toBe(true);
    expect(titleNamesSkill("Engineering Chemistry", "SQL")).toBe(false);
    expect(titleNamesSkill("Postgres internals", "SQL")).toBe(false);
    expect(titleNamesSkill("Statistical Methods", "Statistics")).toBe(false);
  });
  it("adds inferred links for the named skill and the narrower skills under it, never duplicating an existing link", () => {
    const skills = [{ id: "ds", name: "Data Structures", parentId: null }, { id: "sq", name: "Stacks and Queues", parentId: "ds" }, { id: "os", name: "Operating Systems", parentId: null }];
    const r = inferredFromTitle("Data Structures", [], skills);
    expect(r.map((l) => [l.skillId, l.tier])).toEqual([["ds", "INFERRED"], ["sq", "INFERRED"]]);
    expect(inferredFromTitle("Data Structures", [{ skillId: "ds", tier: "OFFICIAL", confidence: null, level: "COURSE" }], skills).map((l) => l.skillId)).toEqual(["sq"]);
    expect(inferredFromTitle("Chemistry", [], skills)).toEqual([]);
  });
});
