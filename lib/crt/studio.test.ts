import { describe, expect, it } from "vitest";
import { SIM_TESTS, categoryOf, inCategory, testQuestionCount } from "./categories";
import { buildBank } from "./content/bank";
import { competency, gradeAnswer, pickPractice, streak, targetDifficulty, type LogEntry } from "./studio";

const entry = (id: string, correct: boolean, over: Partial<LogEntry> = {}): LogEntry => ({ questionId: id, category: "aptitude", points: correct ? 1 : 0, max: 1, correct, day: "2026-11-10", ...over });
const many = (n: number, correct: boolean) => Array.from({ length: n }, (_, i) => entry(`q${i}`, correct));

describe("adaptive practice", () => {
  it("aims easier after misses, harder after a strong run, and in the middle with no history", () => {
    expect(targetDifficulty([])).toBe(2);
    expect(targetDifficulty(many(10, false))).toBe(1);
    expect(targetDifficulty(many(10, true))).toBe(3);
  });

  it("brings back questions answered wrong (at most a third) and prefers unseen ones", () => {
    const pool = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, difficulty: 2 }));
    const history = [entry("q0", false), entry("q1", false), entry("q2", false), entry("q3", false), entry("q4", true)];
    const set = pickPractice(pool, history, 9, () => 0.5);
    expect(set).toHaveLength(9);
    expect(set.filter((q) => ["q0", "q1", "q2", "q3"].includes(q.id))).toHaveLength(3);
    expect(set.some((q) => q.id === "q4")).toBe(false);
  });

  it("leans toward the target difficulty", () => {
    const pool = [1, 2, 3].flatMap((d) => Array.from({ length: 6 }, (_, i) => ({ id: `d${d}-${i}`, difficulty: d })));
    const set = pickPractice(pool, many(10, false).map((e, i) => ({ ...e, questionId: `old${i}` })), 6, () => 0.5);
    expect(set.every((q) => q.difficulty === 1)).toBe(true);
  });
});

describe("gradeAnswer", () => {
  const mcq = [{ key: "a", text: "", points: 0 }, { key: "b", text: "", points: 1 }];
  const sjt = [{ key: "a", text: "", points: 3 }, { key: "b", text: "", points: 1 }, { key: "c", text: "", points: 0 }];
  it("marks the best option correct and reports what it was", () => {
    expect(gradeAnswer(mcq, "b")).toEqual({ points: 1, max: 1, bestKey: "b", correct: true });
    expect(gradeAnswer(mcq, "a")).toMatchObject({ points: 0, correct: false });
    expect(gradeAnswer(sjt, "b")).toEqual({ points: 1, max: 3, bestKey: "a", correct: false });
    expect(gradeAnswer(sjt, "zz")).toMatchObject({ points: 0, correct: false });
  });
});

describe("competency", () => {
  it("is unproven with too little evidence, and lessons never raise it", () => {
    expect(competency(many(4, true), null).pct).toBeNull();
    expect(competency([], null)).toEqual({ pct: null, evidence: 0, practicePct: null, assessmentPct: null });
  });
  it("uses the last 20 answers and blends in the assessment", () => {
    const entries = [...many(10, true), ...many(10, false), ...many(30, true)];
    expect(competency(entries, null).pct).toBe(50);
    expect(competency(entries, 80).pct).toBe(65);
    expect(competency([], 72).pct).toBe(72);
  });
});

describe("streak", () => {
  it("counts consecutive days, keeps yesterday's streak alive, and breaks on a gap", () => {
    expect(streak(["2026-11-10", "2026-11-09", "2026-11-08"], "2026-11-10")).toBe(3);
    expect(streak(["2026-11-09", "2026-11-08"], "2026-11-10")).toBe(2);
    expect(streak(["2026-11-10", "2026-11-08"], "2026-11-10")).toBe(1);
    expect(streak(["2026-11-05"], "2026-11-10")).toBe(0);
  });
});

describe("paths and the bank", () => {
  it("gives every path except speaking enough questions to practise", () => {
    const bank = buildBank();
    for (const c of ["aptitude", "reasoning", "verbal", "soft_skills", "group_discussion", "interview", "workplace"] as const) {
      expect(bank.filter((q) => inCategory(c, q.module, q.topic)).length, c).toBeGreaterThanOrEqual(8);
    }
    expect(bank.every((q) => categoryOf(q.module, q.topic) !== null)).toBe(true);
  });

  it("has a pool big enough for every simulator test, and one minute per question", () => {
    const bank = buildBank();
    for (const t of SIM_TESTS) {
      for (const part of t.parts) expect(bank.filter((q) => inCategory(part.category, q.module, q.topic)).length, `${t.key}/${part.category}`).toBeGreaterThanOrEqual(part.count);
      expect(testQuestionCount(t)).toBeGreaterThan(0);
    }
    expect(testQuestionCount(SIM_TESTS[0])).toBe(44);
  });
});
