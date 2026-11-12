import { describe, expect, it } from "vitest";
import { markFor, NEGATIVE_MARK, totalMarks } from "./marking";
import { scoreAttempt } from "./score";
import type { CrtQuestion } from "./model";

describe("markFor", () => {
  it("rewards right, penalises wrong, ignores blank", () => {
    expect(markFor("aptitude", 1, true)).toBe(1);
    expect(markFor("reasoning", 0, true)).toBe(-NEGATIVE_MARK);
    expect(markFor("verbal", 0, false)).toBe(0);
  });
  it("never penalises a soft-skills answer, whatever it scored", () => {
    expect(markFor("soft_skills", 0, true)).toBe(0);
    expect(markFor("soft_skills", 2, true)).toBe(2);
  });
  it("uses a company's own value when given", () => {
    expect(markFor("aptitude", 0, true, 0.33)).toBe(-0.33);
  });
});

describe("totalMarks", () => {
  it("adds up, rounds off float noise and never drops below zero", () => {
    expect(totalMarks([1, 1, -0.25, -0.25])).toBe(1.5);
    expect(totalMarks([-0.25, -0.25, 1])).toBe(0.5);
    expect(totalMarks([-0.25, -0.25])).toBe(0);
  });
});

describe("scoreAttempt applies negative marking", () => {
  const q = (id: string, module: CrtQuestion["module"], ...pts: number[]): CrtQuestion => ({ id, module, options: pts.map((points, i) => ({ key: "abcd"[i], text: String(i), points })) });
  const questions = [q("1", "aptitude", 1, 0, 0, 0), q("2", "aptitude", 1, 0, 0, 0), q("3", "aptitude", 1, 0, 0, 0), q("4", "aptitude", 1, 0, 0, 0), q("s", "soft_skills", 3, 2, 1, 0)];
  it("2 right, 1 wrong, 1 blank in aptitude = 1.75 of 4", () => {
    const { moduleScores } = scoreAttempt(questions, { "1": "a", "2": "a", "3": "b" });
    expect(moduleScores.aptitude).toEqual({ points: 1.75, max: 4 });
  });
  it("a worst soft-skills answer still earns 0 and is not penalised", () => {
    expect(scoreAttempt(questions, { s: "d" }).moduleScores.soft_skills).toEqual({ points: 0, max: 3 });
  });
  it("an answer key that does not exist counts as blank", () => {
    expect(scoreAttempt(questions, { "1": "zz" }).moduleScores.aptitude.points).toBe(0);
  });
  it("guessing everything wrong floors at zero", () => {
    expect(scoreAttempt(questions, { "1": "b", "2": "b", "3": "b", "4": "b" }).moduleScores.aptitude.points).toBe(0);
  });
});
