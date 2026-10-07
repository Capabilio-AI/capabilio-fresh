import { describe, expect, it, vi } from "vitest";
import { SubmissionSchema, type CheckRow } from "./checks";
import { gradeAttempt, PASS_THRESHOLD_PCT } from "./grade";
import { expiresAtFor, hintPenalty, isFinal, isPastDeadline, SUBMIT_GRACE_SECONDS, timeSpentSeconds } from "./attempt-state";

const num = (id: string, expected: number, over: Partial<CheckRow> = {}): CheckRow => ({ id, stepId: null, checkType: "NUMERIC_ANSWER", label: `Check ${id}`, config: { expected }, visible: true, weight: 1, verification: "SERVER", ...over });
const ctx = { assets: null, runSql: vi.fn() };
const run = (checks: CheckRow[], answers: Record<string, number>, over: { hintPenaltyPoints?: number; difficulty?: string } = {}) =>
  gradeAttempt({ checks, submission: SubmissionSchema.parse({ answers }), ctx, hintPenaltyPoints: over.hintPenaltyPoints ?? 0, difficulty: over.difficulty ?? "medium" });

describe("gradeAttempt", () => {
  it("passes a fully correct, server-verifiable attempt and rewards by difficulty", async () => {
    const g = await run([num("a", 1), num("b", 2)], { a: 1, b: 2 });
    expect(g).toMatchObject({ passed: true, score: 100, checksPassed: 2, checksTotal: 2, evidenceStatus: "VERIFIED_AUTOMATED", points: 20, elo: 12 });
  });

  it("fails below the threshold and rewards nothing", async () => {
    const g = await run([num("a", 1), num("b", 2), num("c", 3)], { a: 1, b: 9, c: 9 });
    expect(g).toMatchObject({ passed: false, weightedPct: 33, evidenceStatus: null, points: 0, elo: 0 });
  });

  it("respects check weights", async () => {
    const g = await run([num("a", 1, { weight: 3 }), num("b", 2, { weight: 1 })], { a: 1, b: 9 });
    expect(g.weightedPct).toBe(75);
    expect(g.passed).toBe(true);
  });

  it("passes exactly at the threshold", async () => {
    const checks = [num("a", 1, { weight: PASS_THRESHOLD_PCT }), num("b", 2, { weight: 100 - PASS_THRESHOLD_PCT })];
    expect((await run(checks, { a: 1, b: 9 })).passed).toBe(true);
  });

  it("hints lower the score and reward but never flip a pass", async () => {
    const g = await run([num("a", 1)], { a: 1 }, { hintPenaltyPoints: 30 });
    expect(g).toMatchObject({ passed: true, score: 70, points: 14, elo: 8 });
    expect((await run([num("a", 1)], { a: 1 }, { hintPenaltyPoints: 500 })).score).toBe(0);
  });

  it("a pass that rests on a browser-reported check is UNVERIFIED", async () => {
    const reported: CheckRow = { ...num("t", 0), checkType: "TEST_RUN" };
    const g = await gradeAttempt({ checks: [num("a", 1), reported], submission: SubmissionSchema.parse({ answers: { a: 1 }, reported: { t: true } }), ctx, hintPenaltyPoints: 0, difficulty: "easy" });
    expect(g).toMatchObject({ passed: true, evidenceStatus: "UNVERIFIED" });
  });

  it("keeps a hidden check's label private", async () => {
    const g = await run([num("a", 1, { visible: false, label: "secret edge case" })], { a: 1 });
    expect(g.outcomes[0].label).toBe("Hidden check");
  });

  it("refuses to grade a challenge with no checks", async () => {
    await expect(run([], {})).rejects.toThrow(/no checks/);
  });
});

describe("attempt state", () => {
  const start = new Date("2026-10-06T10:00:00Z");
  const exp = expiresAtFor(start, 12);
  it("computes the deadline and allows a short grace", () => {
    expect(exp.toISOString()).toBe("2026-10-06T10:12:00.000Z");
    expect(isPastDeadline(exp, new Date(exp.getTime() + SUBMIT_GRACE_SECONDS * 1000))).toBe(false);
    expect(isPastDeadline(exp, new Date(exp.getTime() + SUBMIT_GRACE_SECONDS * 1000 + 1))).toBe(true);
  });
  it("caps time spent at the limit", () => {
    expect(timeSpentSeconds(start, new Date("2026-10-06T10:05:00Z"), 12)).toBe(300);
    expect(timeSpentSeconds(start, new Date("2026-10-06T11:00:00Z"), 12)).toBe(720);
  });
  it("sums the penalty for the first N hints in order", () => {
    const hints = [{ hint_order: 2, penalty_points: 10 }, { hint_order: 1, penalty_points: 5 }, { hint_order: 3, penalty_points: 20 }];
    expect([0, 1, 2, 3].map((n) => hintPenalty(hints, n))).toEqual([0, 5, 15, 35]);
  });
  it("treats every non-running status as final", () => {
    expect(isFinal("IN_PROGRESS")).toBe(false);
    for (const s of ["PASSED", "FAILED", "NEEDS_REVIEW", "EXPIRED", "ABANDONED"] as const) expect(isFinal(s)).toBe(true);
  });
});
