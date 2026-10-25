import { beforeEach, describe, expect, it, vi } from "vitest";

// The real attempts module needs a live database client to load, so only the two functions the explain flow calls are stood in for.
const mocks = vi.hoisted(() => ({
  finishVerified: vi.fn(), closeWithoutRating: vi.fn(), generateExplainQuestions: vi.fn(), scoreExplanation: vi.fn(),
  sessionContextFor: vi.fn(), sessionBrief: vi.fn(), finishSessionRated: vi.fn(), finishSessionUnrated: vi.fn(),
}));
// the Proof Session half of the flow (it needs a database client to load); a daily ticket has no session
vi.mock("@/lib/arena-roles/session/finish", () => ({ sessionContextFor: mocks.sessionContextFor, sessionBrief: mocks.sessionBrief, finishSessionRated: mocks.finishSessionRated, finishSessionUnrated: mocks.finishSessionUnrated }));
vi.mock("./attempts", () => {
  class AttemptError extends Error {
    constructor(message: string, readonly status: number, readonly extra: Record<string, unknown> = {}) { super(message); }
  }
  return { AttemptError, finishVerified: mocks.finishVerified, closeWithoutRating: mocks.closeWithoutRating };
});
vi.mock("./explain", async () => ({ ...(await import("./explain-rules")), generateExplainQuestions: mocks.generateExplainQuestions, scoreExplanation: mocks.scoreExplanation }));
const { finishVerified, closeWithoutRating, generateExplainQuestions, scoreExplanation } = mocks;

import { skipExplanation, startExplanation, submitExplanation } from "./explain-attempts";

type Row = Record<string, unknown>;
/** A tiny in-memory stand-in for the Supabase client: just the calls the explain flow makes. */
function fakeService(tables: Record<string, Row[]>) {
  const from = (name: string) => {
    const rows = (tables[name] ??= []);
    const filters: [string, unknown][] = [];
    let patch: Row | null = null;
    let upsert: Row | null = null;
    const match = () => rows.filter((r) => filters.every(([k, v]) => (v === null ? r[k] == null : r[k] === v)));
    const run = () => {
      if (upsert) { if (!rows.some((r) => r.attempt_id === upsert!.attempt_id)) rows.push({ attempts: 0, questions: null, asked: [], score: null, feedback: null, ...upsert }); return { data: null, error: null }; }
      if (patch) { const hit = match(); hit.forEach((r) => Object.assign(r, patch)); return { data: hit, error: null }; }
      return { data: match(), error: null };
    };
    const builder: Record<string, unknown> = {
      select: () => builder, eq: (k: string, v: unknown) => (filters.push([k, v]), builder), is: (k: string, v: unknown) => (filters.push([k, v]), builder),
      update: (p: Row) => ((patch = p), builder), upsert: (u: Row) => ((upsert = u), builder),
      maybeSingle: async () => ({ data: run().data?.[0] ?? null, error: null }), single: async () => ({ data: run().data?.[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    return builder;
  };
  return { from } as never;
}

const attemptRow = { id: "a1", user_id: "u1", status: "explaining", role_key: "data-analyst", skill_area_key: "sql", challenge_id: "c1", grade: { checks: [{ label: "Query runs", passed: true }] }, submission: { query: "SELECT 1" } };
const tables = (over: Record<string, Row[]> = {}) => ({
  arena_domain_assignments: [{ ...attemptRow }],
  arena_challenges: [{ id: "c1", title: "Fix the count", requester: "Priya · Sales Operations Lead", scenario: "s", objective: "o", difficulty: "easy", tool_type: "sql_workspace" }],
  arena_skill_areas: [{ role_key: "data-analyst", area_key: "sql", display_name: "SQL" }],
  arena_task_interviews: [] as Row[],
  ...over,
});
const QUESTIONS = ["Why did you join like that?", "What did you assume?", "How did you check it?", "What if it were bigger?"];
const GOOD = ["I joined orders to items because the count needs lines collapsed.", "I assumed delivered only, as the request said.", "I compared the count with a distinct count by hand.", "I would pre-aggregate in a CTE before joining."];
const ai = (overallScore: number) => ({ overallScore, answers: QUESTIONS.map(() => ({ score: overallScore, note: "ok" })), strengths: ["specific"], improvements: ["more edge cases"] });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessionContextFor.mockResolvedValue(null);
  generateExplainQuestions.mockResolvedValue(QUESTIONS);
  finishVerified.mockResolvedValue({ points: 8, nextAvailableAt: "2026-10-17T00:00:00Z", evidenceId: null });
  closeWithoutRating.mockResolvedValue("2026-10-17T00:00:00Z");
});

describe("start", () => {
  it("shows the completed task and writes four questions once", async () => {
    const db = tables();
    const service = fakeService(db);
    const v = await startExplanation(service, "u1", "a1");
    expect(v.questions).toEqual(QUESTIONS);
    expect(v.task.title).toBe("Fix the count");
    expect(v.task.submission).toContain("SELECT 1");
    expect(v.task.checks).toEqual(["Query runs"]);
    expect(v.maxAttempts).toBe(2);
    await startExplanation(service, "u1", "a1");
    expect(generateExplainQuestions).toHaveBeenCalledTimes(1);
  });

  it("refuses a task that is not the user's, or not waiting for an explanation", async () => {
    await expect(startExplanation(fakeService(tables()), "someone-else", "a1")).rejects.toMatchObject({ status: 404 });
    await expect(startExplanation(fakeService(tables({ arena_domain_assignments: [{ ...attemptRow, status: "presented" }] })), "u1", "a1")).rejects.toMatchObject({ status: 409 });
  });

  it("does not use anything up when the questions cannot be written", async () => {
    generateExplainQuestions.mockRejectedValue(new Error("llm down"));
    await expect(startExplanation(fakeService(tables()), "u1", "a1")).rejects.toMatchObject({ status: 503 });
  });
});

describe("submit", () => {
  const started = async (db = tables()) => { const service = fakeService(db); await startExplanation(service, "u1", "a1"); return { db, service }; };

  it("awards the rating only after a good explanation, and records the score", async () => {
    scoreExplanation.mockResolvedValue(ai(80));
    const { db, service } = await started();
    const r = await submitExplanation(service, "u1", "a1", GOOD);
    expect(r).toMatchObject({ outcome: "award", score: 80, points: 8 });
    expect(finishVerified).toHaveBeenCalledTimes(1);
    expect(db.arena_task_interviews[0]).toMatchObject({ score: 80, passed: true, attempts: 1 });
  });

  it("gives no rating for blank or one-word answers, however kind the AI is", async () => {
    scoreExplanation.mockResolvedValue(ai(95));
    const { service } = await started();
    const r = await submitExplanation(service, "u1", "a1", ["ok", "yes", "idk", "no"]);
    expect(r.outcome).toBe("retry");
    expect(r.score).toBeLessThanOrEqual(30);
    expect(finishVerified).not.toHaveBeenCalled();
  });

  it("gives a second try with fresh questions, then closes the task without a rating", async () => {
    scoreExplanation.mockResolvedValue(ai(20));
    const { db, service } = await started();
    const first = await submitExplanation(service, "u1", "a1", GOOD);
    expect(first).toMatchObject({ outcome: "retry", triesLeft: 1 });
    expect(db.arena_task_interviews[0].questions).toBeNull();
    generateExplainQuestions.mockResolvedValue(["New one?", "New two?", "New three?", "New four?"]);
    const again = await startExplanation(service, "u1", "a1");
    expect(again.questions[0]).toBe("New one?");
    expect(again.last?.score).toBe(20);
    expect(generateExplainQuestions.mock.calls[1][1]).toEqual(QUESTIONS);
    const second = await submitExplanation(service, "u1", "a1", GOOD);
    expect(second).toMatchObject({ outcome: "close", nextAvailableAt: "2026-10-17T00:00:00Z" });
    expect(closeWithoutRating).toHaveBeenCalledTimes(1);
    expect(finishVerified).not.toHaveBeenCalled();
  });

  it("does not use up a try when the scorer fails", async () => {
    scoreExplanation.mockRejectedValue(new Error("llm down"));
    const { db, service } = await started();
    await expect(submitExplanation(service, "u1", "a1", GOOD)).rejects.toMatchObject({ status: 503 });
    expect(db.arena_task_interviews[0].attempts).toBe(0);
  });

  it("insists on exactly four answers and on starting the interview first", async () => {
    const { service } = await started();
    await expect(submitExplanation(service, "u1", "a1", ["one"])).rejects.toMatchObject({ status: 400 });
    await expect(submitExplanation(fakeService(tables()), "u1", "a1", GOOD)).rejects.toMatchObject({ status: 409 });
    await expect(submitExplanation(service, "u1", "a1", [...GOOD.slice(0, 3), "x".repeat(1300)])).rejects.toMatchObject({ status: 400 });
  });
});

describe("skip", () => {
  it("closes the task with no rating", async () => {
    const r = await skipExplanation(fakeService(tables()), "u1", "a1");
    expect(r.nextAvailableAt).toBe("2026-10-17T00:00:00Z");
    expect(closeWithoutRating).toHaveBeenCalledTimes(1);
    expect(finishVerified).not.toHaveBeenCalled();
  });
});

describe("a Proof Session", () => {
  const ctx = { sessionId: "s1", roleKey: "data-analyst", anchorAttemptId: "a1", stages: [] };
  const brief = { title: "From raw extract to evidence-backed recommendation", requester: null, scenario: "multi-stage", objective: "explain", skill: null, difficulty: "medium", submission: "Stage 1 ...", passedChecks: ["Totals match"] };
  beforeEach(() => {
    mocks.sessionContextFor.mockResolvedValue(ctx);
    mocks.sessionBrief.mockResolvedValue(brief);
    mocks.finishSessionRated.mockResolvedValue({ points: 40, evidenceIds: ["e1", "e2"], nextAvailableAt: "2026-10-22T00:00:00Z" });
    mocks.finishSessionUnrated.mockResolvedValue("2026-10-22T00:00:00Z");
  });
  const started = async (db = tables({ evidence: [{ id: "e1", metadata: {} }, { id: "e2", metadata: {} }] })) => { const service = fakeService(db); await startExplanation(service, "u1", "a1"); return { db, service }; };

  it("interviews on the whole session, not on one stage", async () => {
    const v = await startExplanation(fakeService(tables()), "u1", "a1");
    expect(v.task.title).toBe(brief.title);
    expect(v.task.checks).toEqual(["Totals match"]);
    expect(generateExplainQuestions.mock.calls[0][0]).toMatchObject({ title: brief.title });
  });

  it("will not start the interview while stages remain", async () => {
    mocks.sessionContextFor.mockRejectedValue(Object.assign(new Error("Pass every stage before explaining your work."), { status: 409 }));
    await expect(startExplanation(fakeService(tables()), "u1", "a1")).rejects.toMatchObject({ status: 409 });
    expect(generateExplainQuestions).not.toHaveBeenCalled();
  });

  it("awards every stage through the session finish, with no daily cooldown path", async () => {
    scoreExplanation.mockResolvedValue(ai(80));
    const { db, service } = await started();
    const r = await submitExplanation(service, "u1", "a1", GOOD);
    expect(r).toMatchObject({ outcome: "award", points: 40, nextAvailableAt: "2026-10-22T00:00:00Z" });
    expect(mocks.finishSessionRated).toHaveBeenCalledTimes(1);
    expect(finishVerified).not.toHaveBeenCalled();
    expect((db as Record<string, Row[]>).evidence.map((e) => (e.metadata as { explanationScore: number }).explanationScore)).toEqual([80, 80]);
  });

  it("closes the whole session without a rating after two misses, and on skip", async () => {
    scoreExplanation.mockResolvedValue(ai(20));
    const { service } = await started();
    await submitExplanation(service, "u1", "a1", GOOD);
    generateExplainQuestions.mockResolvedValue(["a?", "b?", "c?", "d?"]);
    await startExplanation(service, "u1", "a1");
    expect(await submitExplanation(service, "u1", "a1", GOOD)).toMatchObject({ outcome: "close" });
    expect(mocks.finishSessionUnrated).toHaveBeenCalledTimes(1);
    expect(closeWithoutRating).not.toHaveBeenCalled();

    expect((await skipExplanation(fakeService(tables()), "u1", "a1")).nextAvailableAt).toBe("2026-10-22T00:00:00Z");
    expect(mocks.finishSessionUnrated).toHaveBeenCalledTimes(2);
    expect(mocks.finishSessionRated).not.toHaveBeenCalled();
  });
});
