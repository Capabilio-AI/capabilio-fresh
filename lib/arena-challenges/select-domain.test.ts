import { describe, expect, it } from "vitest";
import { difficultyForLevel, DOMAIN_SET_SIZE, explainPick, recommendForSkill, selectDomainSet, type DomainCandidate, type SkillGap } from "./select-domain";
import { chooseDomainCareer } from "./career-state";

const gap = (skillId: string, current: number, target: number, importance = "HIGH", hasData = true): SkillGap => ({ skillId, skillName: skillId.toUpperCase(), current, target, importance, hasData });
const ch = (id: string, difficulty: string, ...skillIds: string[]): DomainCandidate => ({ id, difficulty, skillIds });

describe("selectDomainSet", () => {
  it("prefers the challenge that addresses the largest weighted gap", () => {
    const out = selectDomainSet([ch("small", "easy", "css"), ch("big", "easy", "sql")], new Set(), [gap("css", 60, 70), gap("sql", 10, 75)]);
    expect(out[0].id).toBe("big");
    expect(out[0].reason).toMatchObject({ skillId: "sql", current: 10, target: 75 });
  });

  it("weights a critical skill above a low-importance one with the same gap", () => {
    const out = selectDomainSet([ch("low", "easy", "a"), ch("crit", "easy", "b")], new Set(), [gap("a", 0, 50, "LOW"), gap("b", 0, 50, "CRITICAL")]);
    expect(out.map((p) => p.id)).toEqual(["crit", "low"]);
  });

  it("returns foundational to advanced, capped at 8, never solved ones", () => {
    const pool = [...Array.from({ length: 5 }, (_, i) => ch(`h${i}`, "hard", `s${i}`)), ...Array.from({ length: 5 }, (_, i) => ch(`e${i}`, "easy", `s${i}`))];
    const gaps = Array.from({ length: 5 }, (_, i) => gap(`s${i}`, 0, 80));
    const out = selectDomainSet(pool, new Set(["e0"]), gaps);
    expect(out).toHaveLength(DOMAIN_SET_SIZE);
    expect(out.map((p) => p.id)).not.toContain("e0");
    const ranks = out.map((p) => (pool.find((c) => c.id === p.id)!.difficulty === "easy" ? 0 : 2));
    expect([...ranks].sort()).toEqual(ranks);
  });

  it("uses a difficulty that fits the student's level in the skill", () => {
    const out = selectDomainSet([ch("easy", "easy", "sql"), ch("hard", "hard", "sql")], new Set(), [gap("sql", 5, 80)], 1);
    expect(out[0].id).toBe("easy");
  });

  it("limits to two challenges per skill while other skills have content", () => {
    const pool = [ch("a1", "easy", "a"), ch("a2", "easy", "a"), ch("a3", "easy", "a"), ch("b1", "easy", "b")];
    const out = selectDomainSet(pool, new Set(), [gap("a", 0, 90), gap("b", 0, 20)], 3);
    expect(out.map((p) => p.id).sort()).toEqual(["a1", "a2", "b1"]);
  });

  it("still lists career challenges when the student has no gap in their skills, with no invented reason", () => {
    expect(selectDomainSet([ch("x", "medium", "sql")], new Set(), [gap("sql", 90, 75)])).toEqual([{ id: "x", reason: null }]);
  });

  it("returns nothing for an empty pool", () => expect(selectDomainSet([], new Set(), [gap("a", 0, 50)])).toEqual([]));
});

describe("explainPick", () => {
  it("states the real numbers", () => {
    expect(explainPick({ skillId: "sql", skillName: "SQL", current: 38, hasData: true, target: 75 }, "Data Analyst")).toBe("Recommended because your SQL is 38 and the target is 75.");
  });
  it("does not claim a score the student does not have", () => {
    expect(explainPick({ skillId: "sql", skillName: "SQL", current: 0, hasData: false, target: 75 }, "Data Analyst")).toBe("Recommended because SQL has no recorded score yet and the target is 75.");
  });
  it("falls back to the track name when there is no gap reason", () => expect(explainPick(null, "Data Analyst")).toBe("Part of the Data Analyst track."));
});

describe("difficultyForLevel", () => {
  it("bands the level", () => expect([0, 33, 34, 66, 67, 100].map(difficultyForLevel)).toEqual(["easy", "easy", "medium", "medium", "hard", "hard"]));
});

describe("recommendForSkill", () => {
  const pool = [
    { ...ch("a", "hard", "sql"), careerIds: [] as string[] },
    { ...ch("b", "easy", "sql"), careerIds: ["c1"] },
    { ...ch("c", "easy", "sql"), careerIds: [] as string[] },
    { ...ch("d", "easy", "css"), careerIds: ["c1"] },
  ];
  it("returns only that skill's unsolved challenges, career-linked first", () => {
    expect(recommendForSkill({ pool, solvedIds: new Set(), skillId: "sql", careerId: "c1", level: 10 })).toEqual(["b", "c", "a"]);
    expect(recommendForSkill({ pool, solvedIds: new Set(["b"]), skillId: "sql", careerId: "c1", level: 10 })).toEqual(["c", "a"]);
  });
  it("orders by closeness to the student's level without a career", () => {
    expect(recommendForSkill({ pool, solvedIds: new Set(), skillId: "sql", careerId: null, level: 90 })[0]).toBe("a");
  });
});

describe("chooseDomainCareer", () => {
  const c = (n: string) => ({ id: n, key: n, name: n });
  it("never guesses a career", () => {
    expect(chooseDomainCareer({ primary: null, secondary: null, isExploring: false }, "primary")).toEqual({ state: "unset" });
    expect(chooseDomainCareer({ primary: null, secondary: null, isExploring: true }, "primary")).toEqual({ state: "exploring" });
  });
  it("uses the primary career by default and Plan B when asked", () => {
    const intent = { primary: c("Data Analyst"), secondary: c("Product Manager"), isExploring: false };
    expect(chooseDomainCareer(intent, "primary")).toMatchObject({ state: "ready", which: "primary", career: { name: "Data Analyst" }, planB: "Product Manager" });
    expect(chooseDomainCareer(intent, "plan-b")).toMatchObject({ state: "ready", which: "plan-b", career: { name: "Product Manager" } });
  });
  it("reports a missing Plan B rather than substituting the primary", () => {
    expect(chooseDomainCareer({ primary: c("Data Analyst"), secondary: null, isExploring: false }, "plan-b")).toEqual({ state: "no_plan_b", primary: "Data Analyst" });
  });
});
