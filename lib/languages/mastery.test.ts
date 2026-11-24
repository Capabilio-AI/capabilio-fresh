import { describe, expect, it } from "vitest";
import { stepMastery } from "./mastery";
import type { StepState } from "./step-proof";

const s = (over: Partial<StepState>): StepState => ({ answered: 4, correct: 4, total: 4, checkDone: true, challenge: "passed", complete: true, ...over });

describe("stepMastery", () => {
  it("is 100 when every question is right and the coding challenge is passed", () => {
    expect(stepMastery(s({})).pct).toBe(100);
  });
  it("weighs the coding challenge more than the questions: a passed challenge with half the questions right is 80", () => {
    expect(stepMastery(s({ correct: 2 })).pct).toBe(80);
  });
  it("gives only the question share when the challenge is not passed, so it cannot reach the top without coding", () => {
    expect(stepMastery(s({ challenge: "open", complete: false })).pct).toBe(40);
    expect(stepMastery(s({ challenge: "open", complete: false, answered: 0, correct: 0, checkDone: false })).pct).toBe(0);
  });
  it("uses the questions alone when the lesson has no coding challenge yet, and says so", () => {
    const m = stepMastery(s({ challenge: "none", correct: 3 }));
    expect(m.pct).toBe(75);
    expect(m.basis).toContain("no coding challenge yet");
    expect(m.parts[1].value).toBe("challenge coming");
  });
  it("shows what is left to answer", () => {
    expect(stepMastery(s({ answered: 2, correct: 1, checkDone: false, complete: false, challenge: "open" })).parts[0].value).toBe("1/4 right, 2 to answer");
  });
  it("never divides by zero for a lesson with no questions", () => {
    expect(stepMastery(s({ total: 0, answered: 0, correct: 0, checkDone: false, challenge: "none", complete: false })).pct).toBe(0);
  });
});
