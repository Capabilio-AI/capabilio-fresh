import { describe, expect, it } from "vitest";
import { chooseDifficulty, chooseSkill, difficultyFallbacks, estimateSkill, fitTargets, planNext, type Plan, type Target } from "./engine";

const t = (id: string, weight: number, min: number, max: number): Target => ({ id, name: id, weight, min, max });
const targets = [t("sql", 4, 2, 4), t("py", 2, 1, 2), t("viz", 3, 1, 3), t("comm", 1, 0, 1)];

describe("estimateSkill", () => {
  it("has no score and INSUFFICIENT confidence without evidence", () => {
    expect(estimateSkill([])).toMatchObject({ score: null, confidence: "INSUFFICIENT", n: 0 });
  });
  it("is difficulty-aware: three right answers on HARD outrank three on EASY, and 2 of 3 is not a flat 67", () => {
    const all = (d: "EASY" | "HARD") => estimateSkill([0, 1, 2].map(() => ({ difficulty: d, correct: true }))).score!;
    expect(all("HARD")).toBeGreaterThan(all("EASY"));
    const mixed = estimateSkill([{ difficulty: "MEDIUM", correct: true }, { difficulty: "MEDIUM", correct: true }, { difficulty: "MEDIUM", correct: false }]);
    expect(mixed.score).not.toBe(67);
  });
  it("rewards hard hits and punishes easy misses more than the reverse", () => {
    const a = estimateSkill([{ difficulty: "HARD", correct: true }]).score!;
    const b = estimateSkill([{ difficulty: "EASY", correct: true }]).score!;
    const c = estimateSkill([{ difficulty: "EASY", correct: false }]).score!;
    const d = estimateSkill([{ difficulty: "HARD", correct: false }]).score!;
    expect(a).toBeGreaterThan(b);
    expect(c).toBeLessThan(d);
  });
  it("confidence grows with evidence", () => {
    const o = (n: number) => estimateSkill(Array.from({ length: n }, () => ({ difficulty: "MEDIUM" as const, correct: true })));
    expect([o(1).confidence, o(2).confidence, o(3).confidence]).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });
});

describe("fitTargets", () => {
  it("drops minimums of the least important skills first so sum(min) fits the session", () => {
    const fitted = fitTargets([t("a", 4, 3, 4), t("b", 3, 3, 4), t("c", 1, 3, 4)], 6);
    expect(fitted.reduce((s, x) => s + x.min, 0)).toBeLessThanOrEqual(6);
    expect(fitted.find((x) => x.id === "c")!.min).toBe(0);
    expect(fitted.find((x) => x.id === "a")!.min).toBe(3);
  });
});

function simulate(total: number, correctAlways = true) {
  const plan: Plan = { taken: [], answered: {} };
  const taken: { id: string; difficulty: "EASY" | "MEDIUM" | "HARD" }[] = [];
  const answered: Record<string, { difficulty: "EASY" | "MEDIUM" | "HARD"; correct: boolean }[]> = {};
  for (let i = 0; i < total; i++) {
    const next = planNext(fitTargets(targets, total), { taken, answered }, total);
    if (!next) break;
    taken.push({ id: next.target.id, difficulty: next.difficulty });
    (answered[next.target.id] ??= []).push({ difficulty: next.difficulty, correct: correctAlways });
  }
  void plan;
  return { taken, answered };
}

describe("coverage", () => {
  it("meets every minimum and never exceeds a maximum", () => {
    const { taken } = simulate(10);
    for (const x of targets) {
      const n = taken.filter((q) => q.id === x.id).length;
      expect(n, x.id).toBeGreaterThanOrEqual(x.min);
      expect(n, x.id).toBeLessThanOrEqual(x.max);
    }
  });
  it("no skill consumes the whole assessment", () => {
    const { taken } = simulate(11);
    const counts = targets.map((x) => taken.filter((q) => q.id === x.id).length);
    expect(Math.max(...counts)).toBeLessThanOrEqual(4);
    expect(taken.length).toBe(10); // 4+2+3+1 = 10 slots exist; the engine stops instead of overfilling
  });
  it("does not ask the same skill twice in a row when others are open", () => {
    const { taken } = simulate(8);
    for (let i = 1; i < taken.length; i++) expect(taken[i].id === taken[i - 1].id && taken.length > 3).toBe(false);
  });
  it("sequential mode walks general sections in order", () => {
    const secs = [t("s1", 1, 2, 2), t("s2", 1, 2, 2)];
    const taken: { id: string; difficulty: "MEDIUM" }[] = [];
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      const c = chooseSkill(secs, { taken, answered: {} }, 4, { sequential: true })!;
      order.push(c.id);
      taken.push({ id: c.id, difficulty: "MEDIUM" });
    }
    expect(order).toEqual(["s1", "s1", "s2", "s2"]);
  });
});

describe("difficulty", () => {
  it("starts at MEDIUM", () => {
    expect(chooseDifficulty([], [], null)).toBe("MEDIUM");
  });
  it("rises one step at a time after wins and falls after misses", () => {
    const wins = [{ difficulty: "MEDIUM" as const, correct: true }, { difficulty: "MEDIUM" as const, correct: true }];
    expect(chooseDifficulty(wins, wins, "MEDIUM")).toBe("HARD");
    const misses = [{ difficulty: "MEDIUM" as const, correct: false }, { difficulty: "MEDIUM" as const, correct: false }];
    expect(chooseDifficulty(misses, misses, "MEDIUM")).toBe("EASY");
    expect(chooseDifficulty(misses, misses, "HARD")).toBe("MEDIUM"); // never jumps HARD -> EASY
  });
  it("falls back to the nearest difficulty when the pool lacks the wanted one", () => {
    expect(difficultyFallbacks("EASY")).toEqual(["EASY", "MEDIUM", "HARD"]);
    expect(difficultyFallbacks("HARD")).toEqual(["HARD", "MEDIUM", "EASY"]);
    expect(difficultyFallbacks("MEDIUM")[0]).toBe("MEDIUM");
  });
});
