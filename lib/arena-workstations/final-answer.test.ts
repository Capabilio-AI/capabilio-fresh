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

import { expireIfTimedOut, recordWorkTime, submitAttempt, timeIsUp } from "./attempts";

type Row = Record<string, unknown>;
function service(tables: Record<string, Row[]>, rpc?: (fn: string, args: Row) => unknown) {
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
  return { from, rpc: async (fn: string, args: Row) => rpc?.(fn, args) ?? { data: null, error: null } } as never;
}

const ticket = (over: Row = {}) => ({
  arena_domain_assignments: [{ id: "a1", user_id: "u1", role_key: "data-analyst", challenge_id: "c1", status: "presented", completed_at: null, submission_count: 0, skill_area_key: "sql", grade: null, submission: null, proof_session_id: null, time_spent_seconds: 0, ...over }],
  arena_challenges: [{ id: "c1", user_id: "u1", difficulty: "medium", tool_type: "sql_workspace", grading_version: "g1", content: {}, answer_key: {}, time_limit_minutes: 8 }],
});
const checks = (...passed: boolean[]) => passed.map((p, i) => ({ label: `c${i}`, passed: p }));

beforeEach(() => {
  recordMiss.mockReset();
  recordMiss.mockImplementation(async (_u: string, m: { areaChange: number; careerChange: number }) => ({ areaChange: m.areaChange, careerChange: m.careerChange }));
  grade.mockReset();
});

describe("a submission is final", () => {
  it("a wrong answer closes the ticket on the spot, with the next one after the usual wait", async () => {
    grade.mockResolvedValue({ passed: false, message: "Not quite", checks: checks(true, true, false) });
    const t = ticket();
    const r = await submitAttempt(service(t), "u1", "a1", { query: "SELECT 1" });
    expect(r).toMatchObject({ passed: false, final: true });
    const row = t.arena_domain_assignments[0] as Record<string, unknown>;
    expect(row).toMatchObject({ status: "unexplained", submission_count: 1 });
    expect(row.completed_at).toBeTruthy();
    expect(Date.parse(String(row.next_available_at))).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    expect(row.submission).toEqual({ query: "SELECT 1" }); // the closed ticket keeps what the student handed in
  });

  it("cannot be submitted a second time, or taken back", async () => {
    grade.mockResolvedValue({ passed: false, message: "Not quite", checks: checks(false) });
    const t = ticket();
    const db = service(t);
    await submitAttempt(db, "u1", "a1", { query: "SELECT 1" });
    await expect(submitAttempt(db, "u1", "a1", { query: "SELECT 2" })).rejects.toMatchObject({ status: 409 });
    expect(grade).toHaveBeenCalledTimes(1);
  });

  it("scores the wrong answer by how wrong it was: 2 of 3 checks right on a medium ticket costs a third of what it is worth", async () => {
    grade.mockResolvedValue({ passed: false, message: "Not quite", checks: checks(true, true, false) });
    const r = await submitAttempt(service(ticket()), "u1", "a1", { query: "SELECT 1" });
    expect(recordMiss).toHaveBeenCalledWith("u1", expect.objectContaining({ attemptId: "a1", roleKey: "data-analyst", areaChange: -4, careerChange: -3 }));
    expect(r).toMatchObject({ eloChange: -4 });
  });

  it("an answer that gets nothing right loses everything the ticket is worth", async () => {
    grade.mockResolvedValue({ passed: false, message: "No", checks: checks(false, false, false) });
    await submitAttempt(service(ticket()), "u1", "a1", { query: "x" });
    expect(recordMiss).toHaveBeenCalledWith("u1", expect.objectContaining({ areaChange: -12, careerChange: -8 }));
  });

  it("costs nothing for a right answer (the rating waits for the interview) or when grading itself breaks, and leaves a broken grading attempt open", async () => {
    grade.mockResolvedValue({ passed: true, message: "ok", checks: checks(true) });
    const solved = ticket();
    await submitAttempt(service(solved), "u1", "a1", { query: "SELECT 1" });
    expect(solved.arena_domain_assignments[0]).toMatchObject({ status: "explaining" });
    expect(solved.arena_domain_assignments[0].completed_at).toBeNull();

    grade.mockRejectedValue(new Error("grader down"));
    const broken = ticket();
    await expect(submitAttempt(service(broken), "u1", "a1", { query: "SELECT 1" })).rejects.toThrow(/temporarily unavailable/);
    expect(broken.arena_domain_assignments[0]).toMatchObject({ status: "presented", completed_at: null });
    expect(recordMiss).not.toHaveBeenCalled();
  });
});

describe("the ticket's clock", () => {
  it("reports the total kept on the student's account", async () => {
    const rpc = vi.fn(() => ({ data: 95, error: null }));
    expect(await recordWorkTime(service(ticket(), rpc), "u1", "a1")).toBe(95);
    expect(rpc).toHaveBeenCalledWith("beat_attempt_time", { p_attempt: "a1", p_user: "u1" });
  });

  it("never gets in the way of the work: a failed report is just null", async () => {
    expect(await recordWorkTime(service(ticket(), () => ({ data: null, error: new Error("down") })), "u1", "a1")).toBeNull();
  });
});

describe("running out of time with nothing submitted", () => {
  const spent = (seconds: number, over: Row = {}) => ticket({ time_spent_seconds: seconds, ...over });

  it("is up when the time spent reaches the limit, allowing the account's clock to lag by a little", () => {
    expect(timeIsUp(479, 8)).toBe(false);
    expect(timeIsUp(480, 8)).toBe(true);
    expect(timeIsUp(465, 8, 20)).toBe(true);
    expect(timeIsUp(400, 8, 20)).toBe(false);
  });

  it("does nothing while there is time left", async () => {
    const t = spent(100);
    expect(await expireIfTimedOut(service(t), "u1", "a1")).toBeNull();
    expect(t.arena_domain_assignments[0]).toMatchObject({ status: "presented", completed_at: null });
    expect(recordMiss).not.toHaveBeenCalled();
  });

  it("closes the ticket as unanswered and takes the full worth of the ticket from both ratings, like an answer with nothing right", async () => {
    const t = spent(480);
    const r = await expireIfTimedOut(service(t), "u1", "a1");
    expect(r).toMatchObject({ eloChange: -12 });
    expect(Date.parse(r!.nextAvailableAt)).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    const row = t.arena_domain_assignments[0] as Record<string, unknown>;
    expect(row).toMatchObject({ status: "unexplained" });
    expect(row.completed_at).toBeTruthy();
    expect(row.grade).toMatchObject({ passed: false, timed_out: true, checks: [] });
    expect(recordMiss).toHaveBeenCalledWith("u1", expect.objectContaining({ attemptId: "a1", roleKey: "data-analyst", areaChange: -12, careerChange: -8 }));
  });

  it("accepts the browser's report a few seconds before the account's clock catches up, but not long before", async () => {
    expect(await expireIfTimedOut(service(spent(465)), "u1", "a1", 20)).not.toBeNull();
    expect(await expireIfTimedOut(service(spent(465)), "u1", "a1", 0)).toBeNull();
    expect(await expireIfTimedOut(service(spent(300)), "u1", "a1", 20)).toBeNull();
  });

  it("closes a ticket whose time ran out while nobody was looking, the next time it is asked about", async () => {
    // the workspace was closed in the last seconds: the account's clock reads exactly the limit
    const t = spent(480);
    const db = service(t);
    expect(await expireIfTimedOut(db, "u1", "a1")).not.toBeNull();
    await expect(expireIfTimedOut(db, "u1", "a1")).rejects.toMatchObject({ status: 409 }); // already closed: it is charged once
    expect(recordMiss).toHaveBeenCalledTimes(1);
  });

  it("cannot be used on a ticket that is not the student's, is already solved, is being graded, or is a Proof Session stage", async () => {
    await expect(expireIfTimedOut(service(spent(480)), "someone-else", "a1")).rejects.toMatchObject({ status: 404 });
    await expect(expireIfTimedOut(service(spent(480, { status: "explaining" })), "u1", "a1")).rejects.toMatchObject({ status: 409, extra: { code: "not_applicable" } });
    await expect(expireIfTimedOut(service(spent(480, { status: "grading" })), "u1", "a1")).rejects.toMatchObject({ status: 409 });
    await expect(expireIfTimedOut(service(spent(480, { proof_session_id: "s1" })), "u1", "a1")).rejects.toMatchObject({ status: 409, extra: { code: "not_applicable" } });
    expect(recordMiss).not.toHaveBeenCalled();
  });

  it("leaves no way to submit after the ticket has timed out", async () => {
    const db = service(spent(480));
    await expireIfTimedOut(db, "u1", "a1");
    grade.mockResolvedValue({ passed: true, message: "ok", checks: [{ label: "c", passed: true }] });
    await expect(submitAttempt(db, "u1", "a1", { query: "SELECT 1" })).rejects.toMatchObject({ status: 409 });
  });
});
