import { describe, expect, it } from "vitest";
import { readAqua, readArc, readMmlu, toGenerated } from "./datasets";
import { validateQuestion } from "./validate";

const expectFor = (section: string) => ({ skillKey: section, careerKey: null, difficulty: "EASY" as const, minQuestionLength: 25 });

describe("dataset readers", () => {
  it("reads an MMLU row and the result passes the normal question validation", () => {
    const q = readMmlu({ question: "Which data structure works on a last-in, first-out basis?", choices: ["Queue", "Stack", "Heap", "Graph"], answer: 1 })!;
    expect(q.answer).toBe("Stack");
    const v = validateQuestion(toGenerated(q, "programming_fundamentals", "Basic Programming", "EASY"), expectFor("programming_fundamentals"));
    expect(v.ok && v.question.correctIndex).toBe(1);
  });

  it("drops AQuA rows whose options are 'None of these', keeps the key and exactly 3 distractors otherwise", () => {
    const row = { question: "A train 100 m long runs at 36 km/h. How long does it take to pass a pole?", options: ["A)5 s", "B)10 s", "C)15 s", "D)20 s", "E)25 s"], correct: "B", rationale: "" };
    const q = readAqua(row)!;
    expect(q.options).toHaveLength(4);
    expect(q.options).toContain("10 s");
    expect(readAqua({ ...row, options: ["A)1", "B)2", "C)3", "D)4", "E)None of these"] })).toBeNull();
  });

  it("skips ARC rows that are not 4-option", () => {
    expect(readArc({ question: "q", choices: { text: ["a", "b", "c"], label: ["A", "B", "C"] }, answerKey: "A" })).toBeNull();
    expect(readArc({ question: "q", choices: { text: ["a", "b", "c", "d"], label: ["A", "B", "C", "D"] }, answerKey: "C" })?.answer).toBe("c");
  });
});
