import { describe, expect, it } from "vitest";
import { courseState, courseStats, filterCourses, neighbours, nextPick, overall, recommended } from "./catalog";
import type { LearningModule, ModuleTopic } from "./modules";

const topic = (key: string, p: Partial<ModuleTopic> = {}): ModuleTopic => ({ key, title: key, description: "", userState: null, level: null, target: 70, status: "NOT_ASSESSED", learning: 0, ...p });
const mod = (key: string, topics: ModuleTopic[], p: Partial<LearningModule> = {}): LearningModule => ({
  key, title: key, description: "", stage: "CORE", focus: false, progress: null, assessed: 0, topics, practice: { arena: 0, projects: 0, certifications: 0, learning: 0 }, ...p,
});

describe("skillstudio catalog", () => {
  it("counts a course by what evidence proved, not by what was marked", () => {
    const m = mod("m", [topic("a", { status: "TARGET_MET", level: 80 }), topic("b", { userState: "LEARNING", status: "LEARNING" }), topic("c")], { progress: 41.6 });
    expect(courseStats(m)).toEqual({ lessons: 3, proven: 1, learning: 1, pct: 42 });
    expect(courseState(m)).toBe("in-progress");
    expect(courseState(mod("n", [topic("x")]))).toBe("new");
    expect(courseState(mod("d", [topic("x", { status: "TARGET_MET", level: 90 })]))).toBe("complete");
  });

  it("continues what the student marked Learning before anything else", () => {
    const modules = [mod("focus", [topic("big-gap", { level: 5 })], { focus: true }), mod("other", [topic("mine", { userState: "LEARNING", status: "LEARNING", level: 40 })])];
    expect(nextPick(modules)).toMatchObject({ topic: { key: "mine" }, reason: "continue" });
  });

  it("then prefers modules at the student's stage and the biggest gap, skipping proven, skipped and locked topics", () => {
    const modules = [
      mod("focus", [topic("done", { status: "TARGET_MET", level: 90 }), topic("small", { level: 60 }), topic("big", { level: 10 }), topic("skip", { status: "SKIPPED" }), topic("lock", { status: "LOCKED" })], { focus: true }),
    ];
    expect(nextPick(modules)?.topic.key).toBe("big");
    expect(recommended(modules, 5).map((p) => p.topic.key)).toEqual(["small"]);
    expect(nextPick([mod("empty", [topic("d", { status: "TARGET_MET", level: 99 })])])).toBeNull();
  });

  it("spreads recommendations across modules", () => {
    const modules = [mod("a", [topic("a1", { level: 0 }), topic("a2", { level: 1 })], { focus: true }), mod("b", [topic("b1", { level: 0 })], { focus: true })];
    expect(recommended(modules, 2).map((p) => p.topic.key)).toEqual(["b1", "a2"]);
  });

  it("filters by stage, focus and search over module and topic titles", () => {
    const modules = [mod("sql", [topic("joins")], { stage: "FOUNDATION", focus: true }), mod("ml", [topic("regression")], { stage: "SPECIALIZATION" })];
    expect(filterCourses(modules, { stage: "now", query: "" }).map((m) => m.key)).toEqual(["sql"]);
    expect(filterCourses(modules, { stage: "SPECIALIZATION", query: "" }).map((m) => m.key)).toEqual(["ml"]);
    expect(filterCourses(modules, { stage: "all", query: "REGRESS" }).map((m) => m.key)).toEqual(["ml"]);
  });

  it("finds the lessons either side of one", () => {
    const m = mod("m", [topic("a"), topic("b"), topic("c")]);
    expect(neighbours(m, "b")).toMatchObject({ prev: { key: "a" }, next: { key: "c" }, index: 1 });
    expect(neighbours(m, "a").prev).toBeNull();
    expect(neighbours(m, "c").next).toBeNull();
  });

  it("totals across modules", () => {
    const o = overall([mod("a", [topic("1", { status: "TARGET_MET", level: 90 }), topic("2")], { progress: 50 }), mod("b", [topic("3", { level: 10 })], { progress: 10 })]);
    expect(o).toEqual({ lessons: 3, proven: 1, learning: 0, measured: 2, pct: 30 });
  });
});
