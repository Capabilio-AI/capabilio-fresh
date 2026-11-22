import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pythonTrack } from "./python";
import { currentAssessment, emptyProof, ProofConflict, recordProblem, sha256, submitAssessment } from "./module-proof";

const m = pythonTrack.modules.find((x) => x.challenge)!;

/** A stand-in for the proof table that records what was written and lets a test decide how the database answers. */
function fakeDb(opts: { insertError?: { code?: string; message: string } | null; updatedRows?: unknown[] } = {}) {
  const log: { insert: Record<string, unknown> | null; update: Record<string, unknown> | null; where: [string, unknown][] } = { insert: null, update: null, where: [] };
  const table = {
    insert: (v: Record<string, unknown>) => { log.insert = v; return Promise.resolve({ error: opts.insertError ?? null }); },
    update: (v: Record<string, unknown>) => {
      log.update = v;
      const q = { eq: (k: string, val: unknown) => { log.where.push([k, val]); return q; }, select: () => Promise.resolve({ data: opts.updatedRows ?? [{ module_key: m.key }], error: null }) };
      return q;
    },
  };
  return { service: { from: () => table } as unknown as SupabaseClient, log };
}

describe("saving module proof", () => {
  it("inserts the first submission for a module", async () => {
    const { service, log } = fakeDb();
    const state = await recordProblem(service, "u1", pythonTrack, m, emptyProof(), true);
    expect(log.insert).toMatchObject({ user_id: "u1", track: "python", module_key: m.key, problem_attempts: 1 });
    expect(log.update).toBeNull();
    expect(state.problemPassedAt).not.toBeNull();
  });
  it("updates a later submission only while the row is still the one that was read", async () => {
    const { service, log } = fakeDb();
    const read = { ...emptyProof(), assessmentAttempts: 2, problemAttempts: 3 };
    await recordProblem(service, "u1", pythonTrack, m, read, false);
    expect(log.insert).toBeNull();
    expect(log.update).toMatchObject({ problem_attempts: 4, assessment_attempts: 2 });
    expect(log.where).toEqual(expect.arrayContaining([["user_id", "u1"], ["track", "python"], ["module_key", m.key], ["assessment_attempts", 2], ["problem_attempts", 3]]));
  });
  it("refuses a stale write instead of overwriting: the update touched no row", async () => {
    const { service } = fakeDb({ updatedRows: [] });
    await expect(recordProblem(service, "u1", pythonTrack, m, { ...emptyProof(), problemAttempts: 1 }, true)).rejects.toBeInstanceOf(ProofConflict);
  });
  it("refuses a second first-submission made at the same moment: the insert hit the unique key", async () => {
    const { service } = fakeDb({ insertError: { code: "23505", message: "duplicate key" } });
    await expect(recordProblem(service, "u1", pythonTrack, m, emptyProof(), true)).rejects.toBeInstanceOf(ProofConflict);
  });
  it("reports any other database error as a plain failure, not as a conflict", async () => {
    const { service } = fakeDb({ insertError: { code: "XX000", message: "boom" } });
    const err = await recordProblem(service, "u1", pythonTrack, m, emptyProof(), true).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ProofConflict);
  });
});

describe("evidence of how a module was proven", () => {
  const evidence = { language: "python", code: "print(42)\n", passedTests: 8, totalTests: 8 };

  it("keeps the language, the tests met and the passing code with its SHA-256 when a problem is first passed", async () => {
    const { service, log } = fakeDb();
    const state = await recordProblem(service, "u1", pythonTrack, m, emptyProof(), true, evidence);
    expect(log.insert).toMatchObject({ problem_language: "python", problem_tests_passed: 8, problem_tests_total: 8, problem_code: "print(42)\n", problem_code_sha256: sha256("print(42)\n") });
    expect(state).toMatchObject({ problemLanguage: "python", problemTestsPassed: 8, problemCodeSha256: sha256("print(42)\n") });
    // the code itself is never part of the proof state that goes to the browser
    expect(JSON.stringify(state)).not.toContain("print(42)");
  });
  it("records no evidence for a failed attempt", async () => {
    const { service, log } = fakeDb();
    await recordProblem(service, "u1", pythonTrack, m, emptyProof(), false, { ...evidence, passedTests: 3, totalTests: 8 });
    expect(log.insert).toMatchObject({ problem_language: null, problem_code_sha256: null });
    expect(log.insert).not.toHaveProperty("problem_code");
  });
  it("keeps the evidence of the first pass: a later pass does not replace it, and the stored code is not touched", async () => {
    const { service, log } = fakeDb();
    const passed = { ...emptyProof(), problemAttempts: 1, problemPassedAt: "2026-11-22T10:00:00Z", problemLanguage: "python", problemTestsPassed: 8, problemTestsTotal: 8, problemCodeSha256: sha256("first") };
    await recordProblem(service, "u1", pythonTrack, m, passed, true, { ...evidence, code: "second" });
    expect(log.update).toMatchObject({ problem_code_sha256: sha256("first") });
    expect(log.update).not.toHaveProperty("problem_code");
  });
  it("keeps the score of the assessment attempt that passed it", async () => {
    const { service, log } = fakeDb();
    const asked = currentAssessment(m, "u1", emptyProof());
    const answers = Object.fromEntries(asked.map((q) => [q.id, q.answerIndex]));
    const r = await submitAssessment(service, "u1", pythonTrack, m, emptyProof(), answers);
    expect(r.passed).toBe(true);
    expect(log.insert).toMatchObject({ assessment_correct: asked.length, assessment_total: asked.length });
  });
  it("records no score for an attempt that did not pass", async () => {
    const { service, log } = fakeDb();
    const r = await submitAssessment(service, "u1", pythonTrack, m, emptyProof(), {});
    expect(r.passed).toBe(false);
    expect(log.insert).toMatchObject({ assessment_correct: null, assessment_total: null });
  });
});
