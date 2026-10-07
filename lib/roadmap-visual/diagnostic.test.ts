import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ItemSpec, grade, itemProblems, nextDifficulty, planSkills, skillResult } from "./diagnostic";

describe("grade", () => {
  it("grades MCQ, multi-select (order-free, exact set) and numeric (within tolerance)", () => {
    expect(grade("MCQ", { correct: 2 }, { choice: 2 })).toBe(true);
    expect(grade("MCQ", { correct: 2 }, { choice: 1 })).toBe(false);
    expect(grade("MULTI_SELECT", { correct: [0, 2, 3] }, { choices: [3, 0, 2] })).toBe(true);
    expect(grade("MULTI_SELECT", { correct: [0, 2, 3] }, { choices: [0, 2] })).toBe(false);
    expect(grade("MULTI_SELECT", { correct: [0, 2] }, { choices: [0, 2, 2] })).toBe(true);
    expect(grade("NUMERIC", { value: 0.092, tolerance: 0.005 }, { value: 0.09 })).toBe(true);
    expect(grade("NUMERIC", { value: 6, tolerance: 0 }, { value: 6.5 })).toBe(false);
  });
  it("treats a response of the wrong shape as incorrect, never as an error", () => {
    expect(grade("MCQ", { correct: 1 }, { value: 1 })).toBe(false);
    expect(grade("NUMERIC", { value: 1, tolerance: 0 }, { choice: 1 })).toBe(false);
  });
});

describe("nextDifficulty", () => {
  const all = ["easy", "medium", "hard"] as const;
  it("starts at medium, then goes harder after a right answer and easier after a wrong one", () => {
    expect(nextDifficulty([], all)).toBe("medium");
    expect(nextDifficulty([{ difficulty: "medium", correct: true }], all)).toBe("hard");
    expect(nextDifficulty([{ difficulty: "medium", correct: false }], all)).toBe("easy");
  });
  it("stops when two answers are decisive, and always by three", () => {
    expect(nextDifficulty([{ difficulty: "medium", correct: true }, { difficulty: "hard", correct: true }], all)).toBeNull();
    expect(nextDifficulty([{ difficulty: "medium", correct: false }, { difficulty: "easy", correct: false }], all)).toBeNull();
    expect(nextDifficulty([{ difficulty: "medium", correct: true }, { difficulty: "hard", correct: false }], all)).toBe("easy");
    expect(nextDifficulty([{ difficulty: "medium", correct: true }, { difficulty: "hard", correct: false }, { difficulty: "easy", correct: true }], all)).toBeNull();
  });
  it("never repeats a difficulty and copes with missing ones", () => {
    expect(nextDifficulty([{ difficulty: "medium", correct: true }], ["easy", "medium"])).toBe("easy");
    expect(nextDifficulty([], ["hard"])).toBe("hard");
    expect(nextDifficulty([], [])).toBeNull();
  });
});

describe("skillResult", () => {
  it("is null (not assessed) with no answers, never 0", () => expect(skillResult([])).toBeNull());
  it("weights by difficulty and holds a little back so a short check can't show full mastery", () => {
    expect(skillResult([{ difficulty: "medium", correct: true }, { difficulty: "hard", correct: true }])).toMatchObject({ level: 83, confidence: "low" });
    expect(skillResult([{ difficulty: "medium", correct: true }, { difficulty: "hard", correct: true }, { difficulty: "easy", correct: true }])).toMatchObject({ level: 86, confidence: "medium", correct: 3 });
    expect(skillResult([{ difficulty: "medium", correct: false }, { difficulty: "easy", correct: false }])!.level).toBe(0);
    expect(skillResult([{ difficulty: "medium", correct: false }, { difficulty: "easy", correct: true }])!.level).toBe(25);
  });
});

describe("planSkills", () => {
  const t = (skillId: string, importance: "CORE" | "RECOMMENDED" | "OPTIONAL", target: number) => ({ skillId, importance, target });
  it("takes core topics first, only those with items and not already assessed, at most eight", () => {
    const topics = [t("a", "OPTIONAL", 90), t("b", "CORE", 60), t("c", "CORE", 80), t("d", "RECOMMENDED", 70), t("e", "CORE", 70)];
    expect(planSkills(topics, new Set(["a", "b", "c", "d"]), new Set(["b"]))).toEqual(["c", "d", "a"]);
    const many = Array.from({ length: 12 }, (_, i) => t(`s${String(i).padStart(2, "0")}`, "CORE", 70));
    expect(planSkills(many, new Set(many.map((m) => m.skillId)), new Set())).toHaveLength(8);
    expect(planSkills([t("a", "CORE", 70), t("a", "CORE", 70)], new Set(["a"]), new Set())).toEqual(["a"]);
  });
});

describe("the authored items", () => {
  const raw = JSON.parse(readFileSync("content/diagnostics/items.v1.json", "utf8")) as { provenance: unknown; items: unknown[] };
  const items = raw.items.map((i) => ItemSpec.parse(i));
  it("are all well-formed with an in-range answer", () => {
    expect(items).toHaveLength(48);
    for (const i of items) expect(itemProblems(i), i.prompt).toEqual([]);
    expect(raw.provenance).toMatchObject({ author: "Capabilio" });
  });
  it("give every skill an easy, medium and hard item, and no duplicate prompts", () => {
    const by = new Map<string, Set<string>>();
    for (const i of items) by.set(i.skill, new Set([...(by.get(i.skill) ?? []), i.difficulty]));
    expect(by.size).toBe(16);
    for (const [skill, d] of by) expect(d.size, skill).toBe(3);
    expect(new Set(items.map((i) => i.prompt)).size).toBe(items.length);
  });
  it("reject a malformed item", () => {
    expect(itemProblems(ItemSpec.parse({ kind: "MCQ", skill: "SQL", difficulty: "easy", prompt: "Which one?", explanation: "Because.", options: ["a", "b", "c"], correct: 1 }))).toEqual([]);
    expect(itemProblems({ kind: "MCQ", skill: "SQL", difficulty: "easy", prompt: "Which one?", explanation: "Because.", seconds: 30, options: ["a", "b", "c"], correct: 5 })).toContain("the correct answer is outside the options");
    expect(itemProblems({ kind: "MCQ", skill: "SQL", difficulty: "easy", prompt: "Which one?", explanation: "Because.", seconds: 30, options: ["a", "A", "c"], correct: 0 })).toContain("options must be distinct");
  });
});
