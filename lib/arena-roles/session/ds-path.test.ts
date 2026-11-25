import { describe, expect, it } from "vitest";
import { DATA_SCIENTIST } from "../blueprints/data-scientist";
import { DATA_SCIENTIST_PATH } from "../sessions/data-scientist-path";
import { ladderStatus, SessionError, specForSession, startSession } from "./service";
import { memoryStore } from "./memory-store";

const start = (store: ReturnType<typeof memoryStore>, specKey?: string) => startSession(store, { userId: "u1", roleKey: "data-scientist", level: "fresher", specKey });
const reason = async (p: Promise<unknown>) => ((await p.then(() => null, (e: unknown) => e)) as SessionError).reason;
const finish = async (store: ReturnType<typeof memoryStore>) => { await store.closeSession(store.sessions[store.sessions.length - 1].id, "finished"); };

describe("the Data Scientist path", () => {
  it("is four levels whose stages all use enabled areas of the role, and the last covers every area", () => {
    const enabled = new Set(DATA_SCIENTIST.areas.filter((a) => a.status === "enabled").map((a) => a.areaKey));
    expect(DATA_SCIENTIST_PATH).toHaveLength(4);
    for (const spec of DATA_SCIENTIST_PATH) {
      const stages = spec.stagesFor("fresher");
      expect(new Set(stages.map((s) => s.key)).size).toBe(stages.length);
      for (const s of stages) expect(enabled.has(s.areaKey), `${spec.key}/${s.key}`).toBe(true);
    }
    expect(new Set(DATA_SCIENTIST_PATH[3].stagesFor("fresher").map((s) => s.areaKey))).toEqual(enabled);
    expect(DATA_SCIENTIST_PATH.map((s) => s.stagesFor("fresher").length)).toEqual([2, 3, 4, 6]);
  });

  it("opens one level after another", () => {
    expect(ladderStatus(DATA_SCIENTIST_PATH, []).map((l) => l.status)).toEqual(["open", "locked", "locked", "locked"]);
    expect(ladderStatus(DATA_SCIENTIST_PATH, [DATA_SCIENTIST_PATH[0].key]).map((l) => l.status)).toEqual(["done", "open", "locked", "locked"]);
    expect(ladderStatus(DATA_SCIENTIST_PATH, DATA_SCIENTIST_PATH.map((s) => s.key)).map((l) => l.status)).toEqual(["done", "done", "done", "done"]);
  });

  it("starts Level 1 first, and refuses a later or an already proven level", async () => {
    const store = memoryStore();
    expect(await reason(start(store, DATA_SCIENTIST_PATH[1].key))).toBe("level_locked");
    const first = await start(store);
    expect(first.session.specKey).toBe(DATA_SCIENTIST_PATH[0].key);
    expect(first.stages.map((s) => s.areaKey)).toEqual(["exploratory-analysis", "data-storytelling"]);
    await finish(store);
    expect(await reason(start(store, DATA_SCIENTIST_PATH[0].key))).toBe("level_done");
    expect(await reason(start(store, DATA_SCIENTIST_PATH[2].key))).toBe("level_locked");
    const second = await start(store, DATA_SCIENTIST_PATH[1].key);
    expect(second.session.specKey).toBe(DATA_SCIENTIST_PATH[1].key);
    expect(second.stages).toHaveLength(3);
  });

  it("keeps an open session on its own level, and ends the path after the last", async () => {
    const store = memoryStore();
    for (let i = 0; i < 4; i++) { const v = await start(store); expect(v.session.specKey).toBe(DATA_SCIENTIST_PATH[i].key); await finish(store); }
    expect(await reason(start(store))).toBe("path_complete");
    expect(specForSession("data-scientist", DATA_SCIENTIST_PATH[2].key)?.title).toContain("Level 3");
  });

  it("leaves a role without a path as it was", async () => {
    const store = memoryStore();
    const a = await startSession(store, { userId: "u1", roleKey: "data-analyst", level: "fresher" });
    expect(a.stages).toHaveLength(5);
  });
});
