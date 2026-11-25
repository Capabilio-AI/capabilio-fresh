import { describe, expect, it } from "vitest";
import { gateModules, pathProven, walkOrder } from "./sequence";
import type { LearningModule, ModuleTopic } from "./modules";

const topic = (key: string, p: Partial<ModuleTopic> = {}): ModuleTopic => ({ key, title: key, description: "", userState: null, level: null, target: 70, status: "NOT_ASSESSED", learning: 0, provable: true, proofs: 0, ...p });
const mod = (key: string, position: number, topics: ModuleTopic[], p: Partial<LearningModule> = {}): LearningModule => ({
  key, position, title: key, description: "", stage: "CORE", focus: false, progress: null, assessed: 0, topics, practice: { arena: 0, projects: 0, certifications: 0, learning: 0 }, ...p,
});
const met = (key: string) => topic(key, { status: "TARGET_MET", level: 80, proofs: 3 });
const gates = (ms: LearningModule[]) => Object.fromEntries([...gateModules(ms)].map(([k, v]) => [k, v.gate]));

describe("module gate", () => {
  it("walks by stage, then by the path's own order, never by progress", () => {
    const ms = [mod("c2", 1, [topic("a")]), mod("f", 5, [topic("a")], { stage: "FOUNDATION" }), mod("c1", 0, [topic("a")], { progress: 90 })];
    expect(walkOrder(ms).map((m) => m.key)).toEqual(["f", "c1", "c2"]);
  });

  it("opens only the first module that is not proven, and locks everything after it", () => {
    const ms = [mod("a", 0, [met("t")]), mod("b", 1, [topic("t")]), mod("c", 2, [topic("t")])];
    expect(gates(ms)).toEqual({ a: "proven", b: "open", c: "locked" });
    expect(gateModules(ms).get("c")?.blockedBy).toBe("b");
  });

  it("opens the next module as soon as every provable topic of the one before is proven", () => {
    const ms = [mod("a", 0, [met("t1"), met("t2")]), mod("b", 1, [topic("t")])];
    expect(gates(ms)).toEqual({ a: "proven", b: "open" });
  });

  it("does not let a topic nothing can prove block the path, but a skipped topic is not proof", () => {
    const unprovable = mod("a", 0, [met("t1"), topic("t2", { provable: false })]);
    expect(gates([unprovable, mod("b", 1, [topic("t")])])).toEqual({ a: "proven", b: "open" });
    const skipped = mod("a", 0, [met("t1"), topic("t2", { status: "SKIPPED", userState: "SKIPPED" })]);
    expect(gates([skipped, mod("b", 1, [topic("t")])])).toEqual({ a: "open", b: "locked" });
  });

  it("lets a student who already has the evidence walk straight through", () => {
    const ms = [mod("a", 0, [met("t")]), mod("b", 1, [met("t")]), mod("c", 2, [topic("t")])];
    expect(gates(ms)).toEqual({ a: "proven", b: "proven", c: "open" });
    expect(pathProven(ms)).toBe(false);
    expect(pathProven([mod("a", 0, [met("t")]), mod("b", 1, [met("t")])])).toBe(true);
  });

  it("counts what is left to prove", () => {
    const ms = [mod("a", 0, [met("t1"), topic("t2"), topic("t3", { status: "LEARNING" })])];
    expect(gateModules(ms).get("a")?.remaining).toBe(2);
  });
});
