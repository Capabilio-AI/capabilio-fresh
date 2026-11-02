import { describe, expect, it } from "vitest";
import { assessProficiency, type Difficulty, type ProofPoint } from "./levels";

let n = 0;
const pass = (difficulty: Difficulty, o: Partial<ProofPoint> = {}): ProofPoint => ({ attemptId: `a${++n}`, areaKey: "sql", difficulty, submissions: 1, explained: false, ...o });
const many = (k: number, difficulty: Difficulty, o: Partial<ProofPoint> = {}) => Array.from({ length: k }, () => pass(difficulty, o));

describe("skill proficiency", () => {
  it("is not demonstrated without a verified pass", () => {
    const p = assessProficiency([]);
    expect(p.level).toBe(0);
    expect(p.next?.needs).toEqual(["1 verified task passed"]);
  });

  it("never moves past Familiarity on one easy task", () => {
    const p = assessProficiency([pass("easy")]);
    expect(p.level).toBe(1);
    expect(p.name).toBe("Familiarity");
  });

  it("caps a skill proven only by easy tasks at Guided practice, however many", () => {
    const p = assessProficiency(many(20, "easy", { explained: true }));
    expect(p.level).toBe(2);
    expect(p.next?.needs).toContain("2 of them medium or hard");
  });

  it("reaches Independent execution with medium work, quick passes and an explained task", () => {
    const pts = [...many(2, "easy"), ...many(2, "medium", { explained: true })];
    expect(assessProficiency(pts).level).toBe(3);
  });

  it("does not reach Independent execution when every pass took many tries", () => {
    const pts = [...many(2, "easy", { submissions: 6 }), ...many(2, "medium", { submissions: 5, explained: true })];
    const p = assessProficiency(pts);
    expect(p.level).toBe(2);
    expect(p.next?.needs).toEqual(["2 passed within two submissions"]);
  });

  it("does not reach it when nobody has explained any of it", () => {
    const p = assessProficiency([...many(2, "easy"), ...many(2, "medium")]);
    expect(p.level).toBe(2);
    expect(p.next?.needs).toEqual(["1 explained in the interview"]);
  });

  it("needs work in two areas for Workplace application when the skill has two areas, one otherwise", () => {
    const oneArea = [...many(3, "easy"), ...many(3, "medium", { explained: true })];
    expect(assessProficiency(oneArea, 2).level).toBe(3);
    expect(assessProficiency(oneArea, 2).next?.needs).toEqual(["medium or hard work in 2 different areas"]);
    expect(assessProficiency(oneArea, 1).level).toBe(4);
    const twoAreas = [...many(3, "easy"), ...many(2, "medium", { explained: true }), ...many(1, "hard", { areaKey: "debugging", explained: true })];
    expect(assessProficiency(twoAreas, 2).level).toBe(4);
  });

  it("reaches Advanced problem solving only with repeated hard work done well and explained", () => {
    const pts = [...many(3, "easy"), ...many(5, "hard", { explained: true })];
    const p = assessProficiency(pts, 1);
    expect(p.level).toBe(5);
    expect(p.next).toBeNull();
    expect(assessProficiency([...many(3, "easy"), ...many(5, "hard", { submissions: 4, explained: true })], 1).level).toBe(4);
  });

  it("counts a task once even if it appears twice in the data", () => {
    const one = pass("hard", { explained: true });
    expect(assessProficiency([one, one, one, one]).passes).toBe(1);
    expect(assessProficiency([one, one, one, one]).level).toBe(1);
  });

  it("always says why: the criteria of the level reached are returned", () => {
    const p = assessProficiency([...many(2, "easy"), ...many(2, "medium", { explained: true })]);
    expect(p.reached.every((c) => c.met)).toBe(true);
    expect(p.reached.map((c) => c.label)).toContain("1 explained in the interview");
  });
});
