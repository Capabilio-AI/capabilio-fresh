import { describe, expect, it } from "vitest";
import { ASSESSMENT_SIZE, assessmentPool, gradeAssessment, isProven, moduleStatuses, needsProblem, pickAssessment, publicQuestion, type ModuleProofRow } from "./module-gate";
import { lesson, q, sec, type ModuleChallenge, type Track, type TrackModule } from "./types";

const challenge: ModuleChallenge = { title: "t", statement: "s", inputFormat: "i", outputFormat: "o", constraints: [], tests: [{ input: "1\n", output: "1\n" }], exampleCount: 1, explanations: ["e"], reference: "print(1)" };
const mkLesson = (key: string, n = 3) => lesson(key, key, 5, { summary: "s", sections: [sec("a", ["p"]), sec("b", ["p"])], takeaways: ["a", "b", "c"], check: Array.from({ length: n }, (_, i) => q(`q${i}`, ["a", "b", "c", "d"], (i % 4) as 0 | 1 | 2 | 3, "why")) });
const mod = (key: string, withChallenge: boolean, lessons = 4): TrackModule => ({ key, title: key, summary: "", lessons: Array.from({ length: lessons }, (_, i) => mkLesson(`${key}-l${i}`)), ...(withChallenge ? { challenge } : {}) });
const track = (runnerLanguage: Track["runnerLanguage"], modules: TrackModule[]): Track => ({ key: "python", title: "T", runnerLanguage, tagline: "", outcome: "", references: [], modules });
const row = (over: Partial<ModuleProofRow> = {}): ModuleProofRow => ({ assessmentAttempts: 1, assessmentPassedAt: null, problemPassedAt: null, problemAttempts: 0, provenAt: null, ...over });
const PASSED = "2026-11-22T00:00:00Z";

describe("module gate", () => {
  it("opens only the first module until it is proven, then the next, and so on", () => {
    const t = track("python", [mod("a", true), mod("b", true), mod("c", true)]);
    expect(moduleStatuses(t, {})).toEqual(["open", "locked", "locked"]);
    expect(moduleStatuses(t, { a: row({ assessmentPassedAt: PASSED, problemPassedAt: PASSED }) })).toEqual(["proven", "open", "locked"]);
  });
  it("needs the problem as well as the assessment when the module has one the judge can run", () => {
    const t = track("python", [mod("a", true), mod("b", true)]);
    expect(isProven(t, t.modules[0], row({ assessmentPassedAt: PASSED }))).toBe(false);
    expect(isProven(t, t.modules[0], row({ problemPassedAt: PASSED }))).toBe(false);
    expect(isProven(t, t.modules[0], row({ assessmentPassedAt: PASSED, problemPassedAt: PASSED }))).toBe(true);
  });
  it("proves on the assessment alone when there is no problem, or the language cannot be judged", () => {
    expect(needsProblem(track("python", []), mod("a", false))).toBe(false);
    expect(needsProblem(track("sql", []), mod("a", true))).toBe(false);
    expect(isProven(track("sql", []), mod("a", true), row({ assessmentPassedAt: PASSED }))).toBe(true);
  });
});

describe("assessment", () => {
  const m = mod("a", true, 4);
  const pool = assessmentPool(m);
  it("pools every check question with a stable id", () => {
    expect(pool).toHaveLength(12);
    expect(new Set(pool.map((p) => p.id)).size).toBe(12);
  });
  it("asks ten, the same ones for the same attempt and others for the next", () => {
    const a1 = pickAssessment(pool, "u", "a", 1).map((p) => p.id);
    expect(a1).toHaveLength(ASSESSMENT_SIZE);
    expect(pickAssessment(pool, "u", "a", 1).map((p) => p.id)).toEqual(a1);
    expect(pickAssessment(pool, "u", "a", 2).map((p) => p.id)).not.toEqual(a1);
  });
  it("never shows the answer", () => {
    expect(Object.keys(publicQuestion(pool[0]))).toEqual(["id", "question", "options"]);
  });
  it("passes at 70 percent, counts a blank as wrong and ignores an answer for a question not asked", () => {
    const asked = pickAssessment(pool, "u", "a", 1);
    const all = Object.fromEntries(asked.map((x) => [x.id, x.answerIndex]));
    expect(gradeAssessment(asked, all)).toMatchObject({ correct: 10, total: 10, passed: true });
    const seven = Object.fromEntries(asked.slice(0, 7).map((x) => [x.id, x.answerIndex]));
    expect(gradeAssessment(asked, { ...seven, "not-asked:0": 0 })).toMatchObject({ correct: 7, passed: true });
    expect(gradeAssessment(asked, Object.fromEntries(asked.slice(0, 6).map((x) => [x.id, x.answerIndex])))).toMatchObject({ correct: 6, passed: false });
    expect(gradeAssessment([], {}).passed).toBe(false);
  });
});
