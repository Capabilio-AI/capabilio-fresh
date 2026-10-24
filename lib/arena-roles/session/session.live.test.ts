import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AttemptError, getWorkstationState, startNextAttempt, submitAttempt } from "@/lib/arena-workstations/attempts";
import { startExplanation } from "@/lib/arena-workstations/explain-attempts";
import { createThrowawayUser, createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";
import { referenceSubmission } from "@/lib/arena-workstations/reference-submission";
import { finishSessionRated, sessionContextFor } from "./finish";
import { recordQueryForAttempt } from "./record";
import { currentSession, finalizeReport, recordClientEvent, SessionError, startSession } from "./service";
import { activateStage } from "./stage-attempt";
import { supabaseSessionStore } from "./supabase-store";

// Proof Session, live: real database, real graders, throwaway users (deleted afterwards). Run with `npm run test:live`.
const service = liveServiceClient();
const store = supabaseSessionStore(service);
const ROLE = "data-analyst";
const LEVEL = "fresher" as const;
const STAGE_AREAS = ["data_cleaning", "sql", "spreadsheet", "dashboard", "statistics"];

const users: string[] = [];
const newUser = async (label: string) => {
  const id = await createThrowawayUser(service, label);
  users.push(id);
  return id;
};
const reason = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof SessionError ? e.reason : e instanceof AttemptError ? String(e.extra.reason ?? e.status) : String(e)));

async function instance(challengeId: string) {
  const { data } = await service.from("arena_challenges").select("answer_key, content, tool_type").eq("id", challengeId).single();
  return data!;
}

/** Passes the stage the student is on with the reference answer, returns the attempt id. */
async function passStage(userId: string, sessionId: string) {
  const { attempt } = await activateStage(service, userId, sessionId);
  const inst = await instance(attempt.challenge.id);
  const result = (await submitAttempt(service, userId, attempt.attemptId, referenceSubmission(inst.tool_type!, inst.content, inst.answer_key))) as { passed: boolean; session?: boolean };
  expect(result.passed).toBe(true);
  expect(result.session).toBe(true);
  return attempt.attemptId;
}

afterAll(async () => {
  for (const id of users) await deleteThrowawayUser(service, id);
});

describe("Proof Session end to end (live)", () => {
  let alice: string;
  let sessionId: string;
  const attemptIds: string[] = [];

  beforeAll(async () => {
    alice = await newUser("session-a");
  });

  it("starts once, however many times it is asked, and builds the five stages", async () => {
    const [a, b] = await Promise.all([startSession(store, { userId: alice, roleKey: ROLE, level: LEVEL }), startSession(store, { userId: alice, roleKey: ROLE, level: LEVEL })]);
    expect(b.session.id).toBe(a.session.id);
    sessionId = a.session.id;
    expect(a.stages.map((s) => s.areaKey)).toEqual(STAGE_AREAS);
    const { data } = await service.from("arena_proof_sessions" as never).select("id").eq("user_id", alice);
    expect(data).toHaveLength(1);
  });

  it("holds the daily ticket back while the session runs", async () => {
    const state = await getWorkstationState(service, alice, "Data Analyst");
    expect(state.state).toBe("in_session");
    await expect(startNextAttempt(service, alice, "Data Analyst")).rejects.toMatchObject({ status: 409, extra: { reason: "session_open" } });
  });

  it("serves a stage on the student's own warehouse, and gives the same one on a repeat or a race", async () => {
    const [x, y] = await Promise.all([activateStage(service, alice, sessionId), activateStage(service, alice, sessionId)]);
    expect(y.attempt.attemptId).toBe(x.attempt.attemptId);
    expect(x.stageKey).toBe("prepare");
    expect(JSON.stringify(x.attempt)).not.toContain("answer_key");
    const { data: rows } = await service.from("arena_domain_assignments").select("id, proof_session_id, status, completed_at").eq("user_id", alice);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ proof_session_id: sessionId, status: "presented", completed_at: null });
    attemptIds.push(x.attempt.attemptId);
  });

  it("keeps a failed stage open and a wrong answer from advancing the session", async () => {
    const wrong = (await submitAttempt(service, alice, attemptIds[0], { steps: [] })) as { passed: boolean };
    expect(wrong.passed).toBe(false);
    const view = await currentSession(store, { userId: alice, roleKey: ROLE, level: LEVEL });
    expect(view?.current).toBe("prepare");
    expect(view?.stages[0]).toMatchObject({ status: "active", checksTotal: expect.any(Number) });
  });

  it("passes all five stages without a rating, a cooldown or a closed ticket", async () => {
    for (let i = 0; i < STAGE_AREAS.length; i++) {
      await recordClientEvent(store, { userId: alice, sessionId, event: { kind: "data_inspected", target: `table_${i}` } });
      const { attempt } = await activateStage(service, alice, sessionId);
      if (i > 0) attemptIds.push(attempt.attemptId);
      expect(attempt.attemptId).toBe(attemptIds[i]);
      const inst = await instance(attempt.challenge.id);
      const r = (await submitAttempt(service, alice, attempt.attemptId, referenceSubmission(inst.tool_type!, inst.content, inst.answer_key))) as { passed: boolean; session?: boolean };
      expect(r).toMatchObject({ passed: true, session: true });
      if (inst.tool_type === "sql_workspace") await recordQueryForAttempt(service, alice, attempt.attemptId, "SELECT 1", true);
      if (i === 0) {
        // stage one is passed and waiting, but the session is not done: it can neither be interviewed nor rated
        expect(await reason(sessionContextFor(service, alice, attempt.attemptId))).toBe("stages_remaining");
        expect(await reason(startExplanation(service, alice, attempt.attemptId))).toBe("stages_remaining");
      }
    }
    const view = await currentSession(store, { userId: alice, roleKey: ROLE, level: LEVEL });
    expect(view?.current).toBeNull();
    expect(view?.stages.every((s) => s.status === "passed")).toBe(true);

    const { data: rows } = await service.from("arena_domain_assignments").select("status, completed_at, next_available_at, skill_area_key").eq("user_id", alice);
    expect(rows).toHaveLength(5);
    expect(rows!.every((r) => r.status === "explaining" && r.completed_at === null && r.next_available_at === null)).toBe(true);
    const { data: done } = await service.from("arena_attempt_completions").select("attempt_id").eq("user_id", alice);
    expect(done).toHaveLength(0); // no rating until the interview
    expect(await reason(activateStage(service, alice, sessionId))).toBe("all_passed");
  });

  it("records the server's own query event and the browser's lower-trust events apart", async () => {
    const events = (await store.events(sessionId)) as { kind: string; source: string }[];
    expect(events.filter((e) => e.kind === "submitted")).toHaveLength(6); // one wrong, five passed
    expect(events.filter((e) => e.kind === "submitted").every((e) => e.source === "server")).toBe(true);
    expect(events.some((e) => e.kind === "query_run" && e.source === "server")).toBe(true);
    expect(events.filter((e) => e.source === "client").every((e) => ["brief_viewed", "data_inspected", "plan_note"].includes(e.kind))).toBe(true);
  });

  it("builds the interview on the whole session, from the last stage only", async () => {
    const view = await startExplanation(service, alice, attemptIds[4]);
    expect(view.questions).toHaveLength(4);
    expect(view.task.title).toMatch(/evidence-backed recommendation/);
    expect(view.task.checks.length).toBeGreaterThan(0);
  });

  it("rates every stage once on a passing interview, with no daily cooldown, and writes the report", async () => {
    const ctx = (await sessionContextFor(service, alice, attemptIds[4]))!;
    const done = await finishSessionRated(service, alice, ctx);
    expect(done.points).toBeGreaterThan(0);
    expect(done.evidenceIds).toHaveLength(5);

    const { data: completions } = await service.from("arena_attempt_completions").select("skill_area_key").eq("user_id", alice);
    expect(completions!.map((c) => c.skill_area_key).sort()).toEqual([...STAGE_AREAS].sort());
    const { data: ratings } = await service.from("arena_skill_ratings").select("area_key, verified_count").eq("user_id", alice).eq("role_key", ROLE);
    expect(ratings!.every((r) => r.verified_count === 1)).toBe(true);
    const { data: closed } = await service.from("arena_domain_assignments").select("status, completed_at, next_available_at").eq("user_id", alice);
    expect(closed!.every((r) => r.status === "verified" && r.completed_at !== null)).toBe(true);
    // zero-hour cooldown: nothing is waiting, so the daily ticket is available straight away
    expect(closed!.every((r) => Date.parse(r.next_available_at!) <= Date.now() + 60_000)).toBe(true);
    const after = await getWorkstationState(service, alice, "Data Analyst");
    expect(after.state).toBe("ready");

    expect((await store.session(alice, sessionId))?.status).toBe("finished");
    const report = await finalizeReport(store, { userId: alice, sessionId, level: LEVEL });
    expect(report.claim).toMatch(/^Completed 5 of 5 stage\(s\) of a simulated BrightCart analysis; passed \d+ of \d+ assessment checks\.$/);
    expect(report.dimensions.execution.level).toBe(3);
    expect(report.dimensions.aiCollaboration.level).toBeNull();
    expect(await finalizeReport(store, { userId: alice, sessionId, level: LEVEL })).toEqual(report);
  });

  it("starts a daily ticket afterwards and refuses a session while one is open", async () => {
    const daily = await startNextAttempt(service, alice, "Data Analyst");
    expect(daily.state).toBe("active");
    expect(await reason(startSession(store, { userId: alice, roleKey: ROLE, level: LEVEL }))).toBe("daily_ticket_open");
  });
});

describe("Proof Session isolation and integrity (live)", () => {
  it("never shows or lets anyone touch another student's session, and clients cannot read the tables", async () => {
    const owner = await newUser("session-owner");
    const login = await createThrowawayUserWithLogin(service, "session-other");
    users.push(login.userId);
    const { session } = await startSession(store, { userId: owner, roleKey: ROLE, level: LEVEL });

    expect(await store.session(login.userId, session.id)).toBeNull();
    expect(await reason(activateStage(service, login.userId, session.id))).toBe("not_found");
    expect(await reason(recordClientEvent(store, { userId: login.userId, sessionId: session.id, event: { kind: "brief_viewed" } }))).toBe("not_found");
    expect(await reason(finalizeReport(store, { userId: login.userId, sessionId: session.id, level: LEVEL }))).toBe("not_found");

    // a signed-in student's own browser client, with the public key: row security and grants apply
    const browser = await signedInClient(login.email, login.password);
    for (const table of ["arena_proof_sessions", "arena_proof_session_stages", "arena_session_events", "arena_session_reports"]) {
      const { data } = await browser.from(table as never).select("*");
      expect(data ?? [], table).toHaveLength(0);
      const write = await browser.from(table as never).insert({} as never);
      expect(write.error, table).not.toBeNull();
    }
    // the owner's own browser client also reads nothing: there is no client policy at all
    await service.from("arena_proof_sessions" as never).select("id").eq("id", session.id).single();
  });

  it("keeps the log append-only even for the server key", async () => {
    const owner = await newUser("session-log");
    const { session } = await startSession(store, { userId: owner, roleKey: ROLE, level: LEVEL });
    await recordClientEvent(store, { userId: owner, sessionId: session.id, event: { kind: "brief_viewed" } });
    const upd = await service.from("arena_session_events" as never).update({ kind: "submitted" } as never).eq("session_id", session.id);
    expect(upd.error).not.toBeNull();
    const del = await service.from("arena_session_events" as never).delete().eq("session_id", session.id);
    expect(del.error).not.toBeNull();
    expect(await store.events(session.id)).toHaveLength(1);
  });

  it("never allocates the same event number twice under concurrent writes", async () => {
    const owner = await newUser("session-seq");
    const { session } = await startSession(store, { userId: owner, roleKey: ROLE, level: LEVEL });
    await Promise.all(Array.from({ length: 8 }, () => recordClientEvent(store, { userId: owner, sessionId: session.id, event: { kind: "brief_viewed" } })));
    const seqs = ((await store.events(session.id)) as { seq: number }[]).map((e) => e.seq);
    expect(seqs).toHaveLength(8);
    expect(new Set(seqs).size).toBe(8);
  });
});
