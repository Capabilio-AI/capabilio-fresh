import { describe, expect, it } from "vitest";
import { parseEvents, type SessionEvent } from "./events";
import { assessSession } from "./signals";
import { buildReport } from "./report";
import { DATA_ANALYST_STORY } from "../sessions/data-analyst-story";
import { DATA_ANALYST } from "../blueprints/data-analyst";
import { AREA_MIN_LEVEL } from "@/lib/workplace/areas";
import { levelAtLeast } from "@/lib/workplace/level";
import { isRegisteredTool } from "@/lib/arena-workstations/registry";

const S = [{ key: "s", explorable: true }];
const AB = [{ key: "a", explorable: true }, { key: "b", explorable: true }];
let seq = 0;
const ev = <K extends SessionEvent["kind"]>(kind: K, stageKey: string, rest: Omit<Extract<SessionEvent, { kind: K }>, "kind" | "seq" | "at" | "stageKey" | "source"> & { source?: "server" | "client" } = {} as never): SessionEvent =>
  ({ kind, stageKey, seq: ++seq, at: "2026-10-22T10:00:00Z", source: "server", ...rest }) as SessionEvent;
const reset = () => { seq = 0; };

describe("assessSession", () => {
  it("rewards understanding before acting, and counts repeats once", () => {
    reset();
    const events = [ev("stage_started", "s"), ev("brief_viewed", "s", { source: "client" }), ev("data_inspected", "s", { target: "orders", source: "client" }), ev("data_inspected", "s", { target: "customers", source: "client" }), ev("query_run", "s", { sqlHash: "a", ok: true }), ev("query_run", "s", { sqlHash: "a", ok: true }), ev("query_run", "s", { sqlHash: "a", ok: true })];
    const a = assessSession(events, S, 0);
    expect(a.analysis.level).toBe(3);
    expect(a.analysis.trusted).toBe(false);
    expect(a.discovery.level).toBe(2); // 2 sources + 1 distinct query = 3 distinct things; the two repeats add nothing
  });

  it("gives no credit for planning notes that are too short or come late", () => {
    reset();
    const late = [ev("query_run", "s", { sqlHash: "a", ok: true }), ev("plan_note", "s", { words: 12 })];
    expect(assessSession(late, S, 0).planning.level).toBe(2);
    reset();
    expect(assessSession([ev("plan_note", "s", { words: 3 }), ev("query_run", "s", { sqlHash: "a", ok: true })], S, 0).planning.level).toBe(0);
    reset();
    expect(assessSession([ev("plan_note", "s", { words: 12 }), ev("query_run", "s", { sqlHash: "a", ok: true })], S, 0).planning).toMatchObject({ level: 3, trusted: false });
  });

  it("scores judgement on checking and acting on a failure", () => {
    reset();
    expect(assessSession([ev("submitted", "s", { passed: true })], S, 1).judgement.level).toBe(0);
    reset();
    const fixed = [ev("check_run", "s", { passed: 1, total: 3 }), ev("query_run", "s", { sqlHash: "b", ok: true }), ev("check_run", "s", { passed: 3, total: 3 }), ev("submitted", "s", { passed: true })];
    expect(assessSession(fixed, S, 1).judgement.level).toBe(3);
    reset();
    const ignored = [ev("check_run", "s", { passed: 1, total: 3 }), ev("submitted", "s", { passed: false })];
    expect(assessSession(ignored, S, 0).judgement.level).toBe(1);
  });

  it("never penalises not using AI, and rewards testing what the assistant said", () => {
    reset();
    expect(assessSession([ev("query_run", "s", { sqlHash: "a", ok: true })], S, 0).aiCollaboration.level).toBeNull();
    reset();
    const trusting = [ev("ai_prompt", "s", { chars: 20 }), ev("ai_reply", "s", { withheld: false }), ev("submitted", "s", { passed: false })];
    expect(assessSession(trusting, S, 0).aiCollaboration.level).toBe(1);
    reset();
    const testing = [ev("ai_prompt", "s", { chars: 120 }), ev("ai_reply", "s", { withheld: false }), ev("query_run", "s", { sqlHash: "q", ok: true }), ev("submitted", "s", { passed: true })];
    expect(assessSession(testing, S, 1).aiCollaboration.level).toBe(3);
  });

  it("counts a resubmission after a miss as revising the work, since the tools do not report edits", () => {
    reset();
    const retried = [ev("check_run", "s", { passed: 1, total: 3 }), ev("check_run", "s", { passed: 3, total: 3 }), ev("submitted", "s", { passed: true })];
    expect(assessSession(retried, S, 1).judgement.level).toBe(3);
    reset();
    const stillWrong = [ev("check_run", "s", { passed: 1, total: 3 }), ev("check_run", "s", { passed: 2, total: 3 }), ev("submitted", "s", { passed: false })];
    expect(assessSession(stillWrong, S, 0).judgement.level).toBe(2);
  });

  it("assesses Discovery only on stages whose tool reports exploration", () => {
    reset();
    const noExplorers = [{ key: "a" }, { key: "b" }];
    const onlyChecks = [ev("check_run", "a", { passed: 3, total: 3 }), ev("check_run", "b", { passed: 3, total: 3 })];
    expect(assessSession(onlyChecks, noExplorers, 2).discovery).toMatchObject({ level: null });
    // a stage that cannot report exploration never drags Discovery down
    reset();
    const mixed = [{ key: "sql", explorable: true }, { key: "sheet" }];
    const log = [ev("query_run", "sql", { sqlHash: "a", ok: true }), ev("query_run", "sql", { sqlHash: "b", ok: true }), ev("check_run", "sheet", { passed: 3, total: 3 })];
    expect(assessSession(log, mixed, 2).discovery.level).toBe(2);
    // but a stage that can, and shows nothing, is still a zero
    reset();
    expect(assessSession([ev("check_run", "sql", { passed: 1, total: 1 })], mixed, 1).discovery.level).toBe(0);
  });

  it("takes the lowest level across stages, so one good stage cannot hide a skipped one", () => {
    reset();
    const events = [ev("plan_note", "a", { words: 20 }), ev("query_run", "a", { sqlHash: "1", ok: true }), ev("query_run", "b", { sqlHash: "2", ok: true })];
    expect(assessSession(events, AB, 0).planning.level).toBe(0);
  });

  it("says each thing once when every stage showed the same", () => {
    reset();
    const events = [ev("plan_note", "a", { words: 20 }), ev("query_run", "a", { sqlHash: "1", ok: true }), ev("plan_note", "b", { words: 20 }), ev("query_run", "b", { sqlHash: "2", ok: true })];
    expect(assessSession(events, AB, 0).planning.basis).toBe("wrote a plan before running anything");
  });

  it("takes execution only from server grading, never the log", () => {
    reset();
    const claimsEverything = [ev("submitted", "s", { passed: true })];
    expect(assessSession(claimsEverything, S, 0).execution.level).toBe(0);
    expect(assessSession(claimsEverything, S, 1).execution.level).toBe(3);
  });

  it("reports no activity honestly", () => {
    expect(assessSession([], S, 0).analysis).toMatchObject({ level: null, basis: "no activity was recorded" });
  });
});

describe("parseEvents", () => {
  it("drops malformed events and reports how many", () => {
    reset();
    const good = ev("brief_viewed", "s");
    const { events, dropped } = parseEvents([good, { kind: "query_run", seq: 2 }, "junk", null]);
    expect(events).toEqual([good]);
    expect(dropped).toBe(3);
  });
});

describe("buildReport", () => {
  const stages = [{ key: "a", title: "A", passed: true, checksPassed: 3, checksTotal: 3 }, { key: "b", title: "B", passed: false, checksPassed: 1, checksTotal: 4 }];
  it("states only what the server verified", () => {
    reset();
    const r = buildReport({ specKey: "k", specVersion: 1, roleId: "IT-01", worldName: "BrightCart", stages, events: [ev("submitted", "b", { passed: true })], limitations: ["x"] });
    expect(r.claim).toBe("Completed 1 of 2 stage(s) of a simulated BrightCart analysis; passed 4 of 7 assessment checks.");
    expect(r.claim).not.toMatch(/certif|job.ready|professional/i);
    expect(r.dimensions.execution.level).toBe(2); // 1 of 2 stages passed; the log's "passed: true" for stage b is ignored
  });
});

describe("Data Analyst story spec", () => {
  const levels = ["fresher", "junior", "mid", "senior"] as const;
  it("uses only enabled, registered Data Analyst areas the student can actually be served", () => {
    for (const level of levels) {
      for (const stage of DATA_ANALYST_STORY.stagesFor(level)) {
        const area = DATA_ANALYST.areas.find((a) => a.areaKey === stage.areaKey);
        expect(area?.status, `${level}/${stage.key}`).toBe("enabled");
        expect(isRegisteredTool(area!.toolType)).toBe(true);
        expect(levelAtLeast(level, AREA_MIN_LEVEL[stage.areaKey] ?? "fresher"), `${level}/${stage.areaKey}`).toBe(true);
      }
    }
  });

  it("has five distinct stages with unique keys", () => {
    for (const level of levels) {
      const stages = DATA_ANALYST_STORY.stagesFor(level);
      expect(stages).toHaveLength(5);
      expect(new Set(stages.map((s) => s.key)).size).toBe(5);
    }
  });

  it("is the IT-01 Data Analyst session", () => {
    expect([DATA_ANALYST_STORY.roleId, DATA_ANALYST_STORY.domainRoleKey]).toEqual([DATA_ANALYST.roleId, DATA_ANALYST.domainRoleKey]);
  });
});
