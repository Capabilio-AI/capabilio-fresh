import { describe, expect, it } from "vitest";
import { currentStage, currentSession, finalizeReport, recordClientEvent, recordStageResult, SessionError, startSession } from "./service";
import { memoryStore } from "./memory-store";

const U = "u1";
const start = (store = memoryStore(), userId = U, level: "fresher" | "junior" = "fresher") => startSession(store, { userId, roleKey: "data-analyst", level });
const rejects = async (p: Promise<unknown>, reason: string) => {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(SessionError);
  expect((err as SessionError).reason).toBe(reason);
};

describe("startSession", () => {
  it("creates the five Data Analyst stages in order, starting at the first", async () => {
    const v = await start();
    expect(v.stages.map((s) => s.areaKey)).toEqual(["data_cleaning", "sql", "spreadsheet", "dashboard", "statistics"]);
    expect(v.current).toBe("prepare");
    expect(v.stages.every((s) => s.status === "pending" && s.title.length > 0)).toBe(true);
  });

  it("serves the investigation stage only to people who can be served it", async () => {
    expect((await start(memoryStore(), "a", "fresher")).stages[4].areaKey).toBe("statistics");
    expect((await start(memoryStore(), "b", "junior")).stages[4].areaKey).toBe("investigation");
  });

  it("returns the open session instead of creating a second", async () => {
    const store = memoryStore();
    const a = await start(store);
    const b = await start(store);
    expect(b.session.id).toBe(a.session.id);
    expect(store.sessions).toHaveLength(1);
    expect(store.allStages).toHaveLength(5);
  });

  it("returns the winner when two starts race", async () => {
    const store = memoryStore();
    const real = store.openSession.bind(store);
    let first = true;
    // the first look says "no session", then another request creates one before our insert
    store.openSession = async (u, r) => {
      if (first) {
        first = false;
        await real(u, r);
        await store.createSession({ userId: u, roleKey: r, specKey: "da-brightcart-story", specVersion: 1 }, [{ stageKey: "prepare", stageIndex: 0, areaKey: "data_cleaning" }]);
        return null;
      }
      return real(u, r);
    };
    const v = await start(store);
    expect(store.sessions).toHaveLength(1);
    expect(v.session.id).toBe(store.sessions[0].id);
  });

  it("refuses while a daily ticket is open, but lets an already open session through", async () => {
    let daily = true;
    const store = memoryStore({ openDailyTicket: () => daily });
    await rejects(start(store), "daily_ticket_open");
    daily = false;
    await start(store);
    daily = true;
    expect((await start(store)).session.status).toBe("open");
  });

  it("has no session for a role without a spec", async () => {
    await rejects(startSession(memoryStore(), { userId: U, roleKey: "backend-developer", level: "fresher" }), "no_session_for_role");
    await rejects(startSession(memoryStore(), { userId: U, roleKey: "no-such-role", level: "fresher" }), "no_session_for_role");
  });

  it("keeps students apart", async () => {
    const store = memoryStore();
    const a = await start(store, "alice");
    const b = await start(store, "bob");
    expect(b.session.id).not.toBe(a.session.id);
    expect((await currentSession(store, { userId: "alice", roleKey: "data-analyst", level: "fresher" }))?.session.id).toBe(a.session.id);
    expect(await currentSession(store, { userId: "carol", roleKey: "data-analyst", level: "fresher" })).toBeNull();
  });
});

describe("currentStage", () => {
  it("is the first stage not passed, in order", () => {
    const st = (stageIndex: number, status: "pending" | "passed" | "active") => ({ stageKey: `k${stageIndex}`, stageIndex, status });
    expect(currentStage([st(2, "pending"), st(0, "passed"), st(1, "active")])).toBe("k1");
    expect(currentStage([st(0, "passed"), st(1, "passed")])).toBeNull();
  });
});

describe("recordClientEvent", () => {
  it("accepts only the kinds a browser may report, on the current stage", async () => {
    const store = memoryStore();
    const { session } = await start(store);
    await recordClientEvent(store, { userId: U, sessionId: session.id, event: { kind: "brief_viewed" } });
    await recordClientEvent(store, { userId: U, sessionId: session.id, event: { kind: "data_inspected", target: " orders " } });
    await recordClientEvent(store, { userId: U, sessionId: session.id, event: { kind: "plan_note", words: 14 } });
    expect(store.log.get(session.id)).toMatchObject([
      { kind: "brief_viewed", stageKey: "prepare", source: "client" },
      { kind: "data_inspected", target: "orders", source: "client" },
      { kind: "plan_note", words: 14, source: "client" },
    ]);
  });

  it("rejects server-only kinds, so a browser cannot report a pass, a check or an AI exchange", async () => {
    const store = memoryStore();
    const { session } = await start(store);
    for (const kind of ["submitted", "check_run", "query_run", "ai_prompt", "ai_reply", "stage_started", "nonsense"]) {
      await rejects(recordClientEvent(store, { userId: U, sessionId: session.id, event: { kind, passed: true } }), "bad_event");
    }
    expect(store.log.get(session.id) ?? []).toHaveLength(0);
  });

  it("validates event contents", async () => {
    const store = memoryStore();
    const { session } = await start(store);
    for (const event of [{ kind: "data_inspected" }, { kind: "data_inspected", target: "" }, { kind: "data_inspected", target: "x".repeat(121) }, { kind: "plan_note", words: -1 }, { kind: "plan_note", words: 1.5 }, { kind: "plan_note", words: 99999 }, null]) {
      await rejects(recordClientEvent(store, { userId: U, sessionId: session.id, event }), "bad_event");
    }
  });

  it("never lets one student write into another's session", async () => {
    const store = memoryStore();
    const { session } = await start(store, "alice");
    await rejects(recordClientEvent(store, { userId: "mallory", sessionId: session.id, event: { kind: "brief_viewed" } }), "not_found");
    await rejects(recordClientEvent(store, { userId: "alice", sessionId: "nope", event: { kind: "brief_viewed" } }), "not_found");
  });

  it("rejects events once the session is closed", async () => {
    const store = memoryStore();
    const { session } = await start(store);
    await store.closeSession(session.id, "finished");
    await rejects(recordClientEvent(store, { userId: U, sessionId: session.id, event: { kind: "brief_viewed" } }), "closed");
  });
});

describe("stage results and the report", () => {
  it("advances the stage only on a pass, and records the server's own check counts", async () => {
    const store = memoryStore();
    const { session } = await start(store);
    await recordStageResult(store, { sessionId: session.id, stageKey: "prepare", passed: false, checksPassed: 1, checksTotal: 3 });
    expect((await currentSession(store, { userId: U, roleKey: "data-analyst", level: "fresher" }))?.current).toBe("prepare");
    await recordStageResult(store, { sessionId: session.id, stageKey: "prepare", passed: true, checksPassed: 3, checksTotal: 3 });
    expect((await currentSession(store, { userId: U, roleKey: "data-analyst", level: "fresher" }))?.current).toBe("analyse");
    expect(store.log.get(session.id)).toMatchObject([{ kind: "check_run", source: "server" }, { kind: "submitted", passed: false }, { kind: "check_run", passed: 3, total: 3 }, { kind: "submitted", passed: true }]);
  });

  it("builds the report from stored stage results, ignoring what the log claims, and only once", async () => {
    const store = memoryStore();
    const { session } = await start(store);
    await recordStageResult(store, { sessionId: session.id, stageKey: "prepare", passed: true, checksPassed: 3, checksTotal: 3 });
    await recordStageResult(store, { sessionId: session.id, stageKey: "analyse", passed: false, checksPassed: 1, checksTotal: 4 });
    // a forged "passed" event for a stage the server never passed
    await store.appendEvent(session.id, { kind: "submitted", stageKey: "report", source: "client", passed: true });
    const report = await finalizeReport(store, { userId: U, sessionId: session.id, level: "fresher" });
    expect(report.claim).toBe("Completed 1 of 5 stage(s) of a simulated BrightCart analysis; passed 4 of 7 assessment checks.");
    expect(report.stages.find((s) => s.key === "report")?.passed).toBe(false);
    expect(await finalizeReport(store, { userId: U, sessionId: session.id, level: "fresher" })).toBe(report);
  });

  it("will not build a report for someone else's session", async () => {
    const store = memoryStore();
    const { session } = await start(store, "alice");
    await rejects(finalizeReport(store, { userId: "mallory", sessionId: session.id, level: "fresher" }), "not_found");
  });
});
