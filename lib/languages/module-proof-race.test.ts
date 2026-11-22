import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pythonTrack } from "./python";
import { emptyProof, ProofConflict, recordProblem } from "./module-proof";

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
