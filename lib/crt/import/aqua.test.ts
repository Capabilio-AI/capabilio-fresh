import { describe, expect, it } from "vitest";
import { classifyTopic, confirms, difficultyOf, parseAquaRow, questionHash } from "./aqua";

const good = {
  question: "A train 120 m long passes a pole in 6 seconds. What is its speed in km/h?",
  options: ["A)60", "B)72", "C)80", "D)90", "E)100"],
  rationale: "Speed = 120/6 = 20 m/s\n20 x 18/5 = 72 km/h\nThe answer is B.",
  correct: "B",
};

describe("parseAquaRow", () => {
  it("turns a clean row into a five-option question with the right one marked", () => {
    const q = parseAquaRow(good);
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    expect(q.question.prompt).toBe(good.question);
    expect(q.question.options.map((o) => o.text)).toEqual(["60", "72", "80", "90", "100"]);
    expect(q.question.options.map((o) => o.key)).toEqual(["a", "b", "c", "d", "e"]);
    expect(q.question.options.find((o) => o.points === 1)?.text).toBe("72");
    expect(q.question.options.filter((o) => o.points === 1)).toHaveLength(1);
    expect(q.question.topic).toBe("Time, Speed & Distance");
    expect(q.question.explanation).toContain("72 km/h");
  });
  it("drops a row whose worked solution ends on a different answer than the one marked (label noise)", () => {
    expect(parseAquaRow({ ...good, correct: "C" })).toEqual({ ok: false, reason: "worked answer disagrees with the marked answer" });
  });
  it("keeps a row whose solution ends on the answer itself, without naming a letter", () => {
    const row = { ...good, rationale: "Speed = 120/6 = 20 m/s\n20 x 18/5 = 72 km/h" };
    expect(parseAquaRow(row).ok).toBe(true);
    expect(parseAquaRow({ ...row, rationale: "Speed = 120/6 = 20 m/s\n20 x 18/5 = 80 km/h" })).toEqual({ ok: false, reason: "worked answer disagrees with the marked answer" });
    expect(parseAquaRow({ ...row, rationale: "Speed = 120/6 = 20 m/s" })).toEqual({ ok: false, reason: "worked solution does not confirm the marked answer" });
  });
  it("drops rows that need a picture, have a broken option list or are too short", () => {
    expect(parseAquaRow({ ...good, question: "In the figure shown, find the area of the triangle." })).toMatchObject({ ok: false });
    expect(parseAquaRow({ ...good, options: ["A)60", "B)72"] })).toMatchObject({ ok: false });
    expect(parseAquaRow({ ...good, options: ["A)60", "B)60", "C)80", "D)90", "E)100"] })).toMatchObject({ ok: false });
    expect(parseAquaRow({ ...good, question: "Find x." })).toMatchObject({ ok: false });
    expect(parseAquaRow({ ...good, correct: "Z" })).toMatchObject({ ok: false });
  });
  it("copes with garbage without throwing", () => {
    expect(parseAquaRow(null)).toMatchObject({ ok: false });
    expect(parseAquaRow({ question: 5 })).toMatchObject({ ok: false });
  });
});

describe("classifyTopic", () => {
  it("files a question under the CRT aptitude topic it is about", () => {
    expect(classifyTopic("What is 20% of 150?")).toBe("Percentages");
    expect(classifyTopic("A shopkeeper sells at a loss of 5% on the cost price")).toBe("Profit & Loss");
    expect(classifyTopic("Two pipes fill a tank in 10 and 15 hours")).toBe("Time & Work");
    expect(classifyTopic("The ratio of boys to girls is 3:4")).toBe("Ratio & Proportion");
    expect(classifyTopic("Interest on Rs 5000 at 8% per annum")).toBe("Simple & Compound Interest");
    expect(classifyTopic("The average of five numbers is 20")).toBe("Averages");
    expect(classifyTopic("In how many ways can 5 people be arranged in a row?")).toBe("Permutation & Probability");
    expect(classifyTopic("Solve for x: 3x + 2 = 11")).toBe("Algebra & Numbers");
  });
});

describe("difficultyOf", () => {
  it("rates a short worked solution easy and a long one hard", () => {
    expect(difficultyOf("20 x 18/5 = 72\nThe answer is B.")).toBe(1);
    expect(difficultyOf(Array.from({ length: 6 }, (_, i) => `step ${i}`).join("\n"))).toBe(2);
    expect(difficultyOf(Array.from({ length: 12 }, (_, i) => `step ${i}`).join("\n"))).toBe(3);
  });
});

describe("questionHash", () => {
  it("is the same for the same question however it is spaced or cased, and different otherwise", () => {
    const a = questionHash("What is 2+2?", ["3", "4"]);
    expect(questionHash("  what   is 2+2? ", ["3", "4"])).toBe(a);
    expect(questionHash("What is 2+3?", ["3", "4"])).not.toBe(a);
  });
});

describe("confirms", () => {
  const opts = ["60", "72", "80", "90", "100"];
  it("trusts a stated letter in its several wordings", () => {
    expect(confirms("so\nThe answer is B.", opts, 1)).toBe("yes");
    expect(confirms("so\nAnswer: B", opts, 1)).toBe("yes");
    expect(confirms("so\nCorrect answer is (C)", opts, 1)).toBe("no");
    expect(confirms("so\nOption B", opts, 1)).toBe("yes");
  });
  it("does not mistake 72 for part of 172", () => {
    expect(confirms("= 172", opts, 1)).toBe("unclear");
  });
});
