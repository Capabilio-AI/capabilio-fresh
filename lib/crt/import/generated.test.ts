import { describe, expect, it } from "vitest";
import { hashOf, rankingAgrees, softQuestion, soundResponses, verbalQuestion } from "./generated";

const item = { situation: "A teammate keeps missing the deadlines the team agreed on.", responses: ["Talk to them privately and offer help", "Do their work silently", "Complain to everyone", "Ignore it"], why: "Direct, kind, early." };

describe("soft skills", () => {
  it("scores the intended best response 3 and worst 0 wherever it lands after shuffling", () => {
    const q = softQuestion("Teamwork", item, [2, 0, 3, 1]);
    expect(q.options.map((o) => o.points)).toEqual([1, 3, 0, 2]);
    expect(q.options.find((o) => o.points === 3)?.text).toBe(item.responses[0]);
    expect(q.options.find((o) => o.points === 0)?.text).toBe(item.responses[3]);
    expect(q.prompt.endsWith("What would you do?")).toBe(true);
  });
  it("keeps a scenario only when an independent reader picks the same best and worst", () => {
    const order = [2, 0, 3, 1]; // position 1 shows original 0 (best), position 2 shows original 3 (worst)
    expect(rankingAgrees({ best: 1, worst: 2 }, order)).toBe(true);
    expect(rankingAgrees({ best: 0, worst: 2 }, order)).toBe(false);
    expect(rankingAgrees({ best: 1, worst: 0 }, order)).toBe(false);
  });
  it("rejects repeated responses and catch-alls", () => {
    expect(soundResponses(item.responses)).toBe(true);
    expect(soundResponses(["a b c", "A  B C", "x y z", "q r s"])).toBe(false);
    expect(soundResponses(["a b c", "d e f", "g h i", "All of the above"])).toBe(false);
  });
});

describe("verbal", () => {
  const v = { question: "Choose the correct sentence.", options: ["He go to work.", "He goes to work.", "He going work.", "He gone to work."], correct: 1, why: "Third person singular takes -s." };
  it("marks exactly the right option after shuffling", () => {
    const q = verbalQuestion("Grammar", v, [3, 1, 0, 2])!;
    expect(q.options.map((o) => o.points)).toEqual([0, 1, 0, 0]);
    expect(q.options[1].text).toBe("He goes to work.");
  });
  it("drops a question with repeated options", () => {
    expect(verbalQuestion("Grammar", { ...v, options: ["x y z", "x y z", "p q r", "s t u"] }, [0, 1, 2, 3])).toBeNull();
  });
  it("fingerprints the same question the same way", () => {
    expect(hashOf("Hi  there", ["A", "b"])).toBe(hashOf("hi there", ["a", "B"]));
  });
});
