import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// the modules under test import the database client, which reads its settings when loaded; no connection is ever made here
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "test-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-key";
});

const recordMiss = vi.fn();
const grade = vi.fn();
vi.mock("@/lib/assess/arena", () => ({ recordArenaMiss: (...a: unknown[]) => recordMiss(...a), recordArenaPass: vi.fn() }));
vi.mock("./registry", () => ({
  isRegisteredTool: () => true,
  toolFor: () => ({ toolType: "sql_workspace", gradingVersion: "g1", submissionSchema: z.object({ query: z.string() }), grade: (...a: unknown[]) => grade(...a) }),
}));

import { skipAttempt, submitAttempt } from "./attempts";

type Row = Record<string, unknown>;
function service(tables: Record<string, Row[]>) {
  const from = (name: string) => {
    const rows = (tables[name] ??= []);
    let pending: Row[] = rows;
    let patch: Row | null = null;
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => ((pending = pending.filter((r) => r[c] === v)), api),
      is: (c: string, v: unknown) => ((pending = pending.filter((r) => (r[c] ?? null) === v)), api),
      lt: () => api,
      maybeSingle: async () => ({ data: pending[0] ?? null, error: null }),
      single: async () => ({ data: pending[0] ?? null, error: null }),
      update: (p: Row) => ((patch = p), api),
      then: (resolve: (v: unknown) => void) => {
        if (patch) for (const r of pending) Object.assign(r, patch);
        resolve({ data: pending, error: null });
      },
    };
    return api;
  };
  return { from } as never;
}

const world = (over: Row = {}) => ({
  arena_domain_assignments: [{ id: "a1", user_id: "u1", role_key: "data-analyst", challenge_id: "c1", status: "presented", completed_at: null, submission_count: 0, skill_area_key: "sql", grade: null, submission: null, proof_session_id: null, ...over }],
  arena_challenges: [{ id: "c1", user_id: "u1", difficulty: "medium", tool_type: "sql_workspace", grading_version: "g1", content: {}, answer_key: {} }],
});

beforeEach(() => {
  recordMiss.mockReset();
  recordMiss.mockResolvedValue({ elo: 394, change: -6 });
  grade.mockReset();
});

describe("a wrong answer costs rating", () => {
  it("charges half of what a medium ticket earns on the first wrong answer, and says so", async () => {
    grade.mockResolvedValue({ passed: false, message: "Not quite", checks: [{ label: "Result matches", passed: false }] });
    const r = await submitAttempt(service(world()), "u1", "a1", { query: "SELECT 1" });
    expect(r).toMatchObject({ passed: false, eloChange: -6, chargedMisses: 1 });
    expect(recordMiss).toHaveBeenCalledWith("u1", expect.objectContaining({ attemptId: "a1", roleKey: "data-analyst", submissionNumber: 1, elo: 12 }));
  });

  it("stops charging after the third wrong answer on the same ticket", async () => {
    grade.mockResolvedValue({ passed: false, message: "Not quite", checks: [] });
    const w = world({ submission_count: 3 });
    recordMiss.mockClear();
    const r = await submitAttempt(service(w), "u1", "a1", { query: "SELECT 1" });
    expect(recordMiss).not.toHaveBeenCalled();
    expect(r).toMatchObject({ passed: false, eloChange: 0, chargedMisses: 3 });
  });

  it("charges nothing when the answer is right (the rating waits for the interview) or when grading itself breaks", async () => {
    grade.mockResolvedValue({ passed: true, message: "ok", checks: [] });
    await submitAttempt(service(world()), "u1", "a1", { query: "SELECT 1" });
    grade.mockRejectedValue(new Error("grader down"));
    await expect(submitAttempt(service(world()), "u1", "a1", { query: "SELECT 1" })).rejects.toThrow(/temporarily unavailable/);
    expect(recordMiss).not.toHaveBeenCalled();
  });
});

describe("skipping a ticket", () => {
  it("closes it, starts the wait for the next one, and costs a wrong answer's worth once", async () => {
    const w = world();
    const r = await skipAttempt(service(w), "u1", "a1");
    expect(r.eloChange).toBe(-6);
    expect(Date.parse(r.nextAvailableAt)).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    expect(w.arena_domain_assignments[0]).toMatchObject({ status: "cancelled" });
    expect(w.arena_domain_assignments[0].completed_at).toBeTruthy();
    expect(recordMiss).toHaveBeenCalledWith("u1", expect.objectContaining({ submissionNumber: 0, elo: 12 }));
  });

  it("is free once the ticket has already cost its three wrong answers", async () => {
    await skipAttempt(service(world({ submission_count: 3 })), "u1", "a1");
    expect(recordMiss).not.toHaveBeenCalled();
  });

  it("cannot skip a solved ticket, a closed one, someone else's, or a Proof Session stage", async () => {
    await expect(skipAttempt(service(world({ status: "explaining" })), "u1", "a1")).rejects.toMatchObject({ status: 409 });
    await expect(skipAttempt(service(world({ completed_at: "2026-11-01T00:00:00Z" })), "u1", "a1")).rejects.toMatchObject({ status: 409 });
    await expect(skipAttempt(service(world()), "someone-else", "a1")).rejects.toMatchObject({ status: 404 });
    await expect(skipAttempt(service(world({ proof_session_id: "s1" })), "u1", "a1")).rejects.toMatchObject({ status: 409 });
    expect(recordMiss).not.toHaveBeenCalled();
  });
});
