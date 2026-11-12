import { describe, expect, it } from "vitest";
import { appliesTo, attemptExpired, cycleStatusAt, suggestNextWindow } from "./cycle";
import type { CrtQuestion } from "./model";
import { bandFor, scoreAttempt } from "./score";

const mcq = (id: string, module: CrtQuestion["module"], right: string): CrtQuestion => ({
  id,
  module,
  options: ["a", "b", "c"].map((key) => ({ key, text: key, points: key === right ? 1 : 0 })),
});
const sjt = (id: string): CrtQuestion => ({ id, module: "soft_skills", options: [{ key: "a", text: "", points: 3 }, { key: "b", text: "", points: 1 }, { key: "c", text: "", points: 0 }] });

describe("scoreAttempt", () => {
  const qs = [mcq("q1", "aptitude", "a"), mcq("q2", "aptitude", "b"), mcq("q3", "reasoning", "c"), sjt("q4")];

  it("scores right answers, takes 0.25 off a wrong one, treats a skipped question as 0, and weights modules equally", () => {
    const { moduleScores, totalPct } = scoreAttempt(qs, { q1: "a", q2: "c", q3: "c", q4: "b" });
    expect(moduleScores.aptitude).toEqual({ points: 0.75, max: 2 }); // q1 right (+1), q2 wrong (−0.25)
    expect(moduleScores.reasoning).toEqual({ points: 1, max: 1 });
    expect(moduleScores.soft_skills).toEqual({ points: 1, max: 3 });
    expect(moduleScores.verbal).toEqual({ points: 0, max: 0 });
    expect(totalPct).toBe(56.9); // (37.5 + 100 + 33.3) / 3; verbal was not served so it does not drag the total down
  });

  it("ignores an answer key that is not an option", () => {
    expect(scoreAttempt(qs, { q1: "zzz" }).moduleScores.aptitude.points).toBe(0);
  });

  it("scores an empty attempt as 0 without dividing by zero", () => {
    expect(scoreAttempt([], {}).totalPct).toBe(0);
  });
});

describe("bandFor", () => {
  it.each([[0, "needs_work"], [39.9, "needs_work"], [40, "developing"], [60, "proficient"], [80, "strong"], [100, "strong"]])("%s -> %s", (pct, band) => {
    expect(bandFor(pct)).toBe(band);
  });
});

describe("cycle rules", () => {
  const c = { opensOn: "2026-12-01", closesOn: "2026-12-15" };
  it("is open from the exact opening time to the exact closing time", () => {
    const c = { opensAt: "2026-12-01T10:00:00+05:30", closesAt: "2026-12-01T18:00:00+05:30" };
    expect(cycleStatusAt(c, new Date("2026-12-01T09:59:59+05:30"))).toBe("upcoming");
    expect(cycleStatusAt(c, new Date("2026-12-01T10:00:00+05:30"))).toBe("open");
    expect(cycleStatusAt(c, new Date("2026-12-01T18:00:00+05:30"))).toBe("open");
    expect(cycleStatusAt(c, new Date("2026-12-01T18:00:01+05:30"))).toBe("closed");
  });

  it("applies to everyone when no scope is set, and honours branch codes and years", () => {
    expect(appliesTo({ branches: null, years: null }, "CSE", 2)).toBe(true);
    expect(appliesTo({ branches: ["CSE"], years: [3] }, "Computer Science and Engineering (CSE)", 3)).toBe(true);
    expect(appliesTo({ branches: ["ECE"], years: null }, "Computer Science and Engineering (CSE)", 3)).toBe(false);
    expect(appliesTo({ branches: null, years: [4] }, "CSE", 3)).toBe(false);
    expect(appliesTo({ branches: null, years: [4] }, "CSE", null)).toBe(false);
  });

  it("suggests the next window six months after the last one, two weeks long", () => {
    expect(suggestNextWindow("2026-06-01", "2026-11-10")).toEqual({ opensOn: "2026-12-01", closesOn: "2026-12-15" });
    expect(suggestNextWindow("2026-01-01", "2026-11-10")).toEqual({ opensOn: "2026-11-10", closesOn: "2026-11-24" }); // overdue: start now
    expect(suggestNextWindow(null, "2026-11-10")).toEqual({ opensOn: "2027-05-10", closesOn: "2027-05-24" });
  });

  it("ends an attempt at its deadline plus a short grace", () => {
    const deadline = "2026-11-10T10:00:00Z";
    expect(attemptExpired(deadline, new Date("2026-11-10T10:00:10Z"))).toBe(false);
    expect(attemptExpired(deadline, new Date("2026-11-10T10:00:16Z"))).toBe(true);
  });
});

describe("attempt helpers", () => {
  it("draws up to N per module, preferring questions the student has not seen, in module order", async () => {
    const { drawQuestionIds } = await import("./server");
    const pool = ["aptitude", "reasoning", "verbal", "soft_skills"].flatMap((m) => [1, 2, 3, 4].map((i) => ({ id: `${m}${i}`, module: m as CrtQuestion["module"] })));
    const seen = new Set(["aptitude1", "aptitude2"]);
    const ids = drawQuestionIds(pool, seen, 2);
    expect(ids).toHaveLength(8);
    expect(ids.slice(0, 2).sort()).toEqual(["aptitude3", "aptitude4"]);
    expect(ids[2]).toMatch(/^reasoning/);
    expect(drawQuestionIds(pool, new Set(pool.map((q) => q.id)), 3)).toHaveLength(12); // everything seen: repeats rather than a short test
  });

  it("keeps only answers to this attempt's questions", async () => {
    const { cleanAnswers } = await import("./server");
    expect(cleanAnswers(["q1", "q2"], { q1: "a", q3: "b", q2: "" })).toEqual({ q1: "a" });
    expect(cleanAnswers(["q1"], { q1: "x".repeat(50) })).toEqual({});
  });
});
