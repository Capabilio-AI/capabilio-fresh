import { describe, expect, it } from "vitest";
import { buildSyllabus, type MapTopic } from "./syllabus-map";
import type { CurriculumCourse } from "./coverage";

const course = (id: string, year: number, semester: number | null, skillIds: string[], confidence: number | null = null): CurriculumCourse => ({
  id, title: `Course ${id}`, code: null, year, semester, pages: null, analysed: true, units: [{ id: `u-${id}`, no: 1, title: "Unit one" }], outcomes: [],
  links: skillIds.map((skillId) => ({ skillId, tier: confidence === null ? "OFFICIAL" : "INFERRED", confidence, level: "COURSE" as const })),
});
const topic = (key: string, skillId: string, level: number | null, target = 60): MapTopic => ({ key, title: key, skillId, target, level });
const POS = { year: 2, semester: 1 };

describe("buildSyllabus", () => {
  it("is PROVEN only when every topic the subject teaches reached its target", () => {
    const [s] = buildSyllabus([course("a", 1, 1, ["s1", "s2"])], [topic("t1", "s1", 70), topic("t2", "s2", 60)], POS, 0.7);
    expect(s).toMatchObject({ status: "PROVEN", provenCount: 2 });
  });
  it("is IN_PROGRESS when some evidence exists but not all targets are met", () => {
    expect(buildSyllabus([course("a", 1, 1, ["s1", "s2"])], [topic("t1", "s1", 70), topic("t2", "s2", null)], POS, 0.7)[0].status).toBe("IN_PROGRESS");
    expect(buildSyllabus([course("a", 1, 1, ["s1"])], [topic("t1", "s1", 20)], POS, 0.7)[0].status).toBe("IN_PROGRESS");
  });
  it("is NOT_PROVEN with no evidence and NOT_MAPPED when it teaches none of the career's topics", () => {
    expect(buildSyllabus([course("a", 1, 1, ["s1"])], [topic("t1", "s1", null)], POS, 0.7)[0].status).toBe("NOT_PROVEN");
    expect(buildSyllabus([course("a", 1, 1, ["other"])], [topic("t1", "s1", 90)], POS, 0.7)[0]).toMatchObject({ status: "NOT_MAPPED", topics: [] });
  });
  it("ignores inferred links below the confidence threshold", () => {
    expect(buildSyllabus([course("a", 1, 1, ["s1"], 0.4)], [topic("t1", "s1", 90)], POS, 0.7)[0].status).toBe("NOT_MAPPED");
    expect(buildSyllabus([course("a", 1, 1, ["s1"], 0.9)], [topic("t1", "s1", 90)], POS, 0.7)[0].status).toBe("PROVEN");
  });
  it("orders by year then semester and tags timing from the student's position", () => {
    const out = buildSyllabus([course("c", 3, 1, []), course("a", 1, 2, []), course("b", 2, 1, [])], [], POS, 0.7);
    expect(out.map((s) => s.courseId)).toEqual(["a", "b", "c"]);
    expect(out.map((s) => s.timing)).toEqual(["COMPLETED", "CURRENT", "UPCOMING"]);
  });
});
