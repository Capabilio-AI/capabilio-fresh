import { describe, expect, it } from "vitest";
import { groupGoalDemand, type GoalRequestRow } from "./goal-demand";

const r = (goal_key: string, goal_text: string, user_id: string, created_at: string, status = "OPEN"): GoalRequestRow => ({ goal_key, goal_text, user_id, created_at, status });

describe("groupGoalDemand", () => {
  const rows = [
    r("deep sea diver", "Deep sea diver", "u1", "2026-11-01"),
    r("deep sea diver", "I want to become a deep sea diver", "u2", "2026-11-03"),
    r("deep sea diver", "deep sea diver", "u3", "2026-11-02"),
    r("fashion stylist", "fashion stylist", "u4", "2026-11-05"),
    r("pilot", "pilot", "u1", "2026-11-04"),
    r("pilot", "pilot", "u5", "2026-11-06"),
  ];
  it("counts different students per goal and ranks the most asked first", () => {
    const out = groupGoalDemand(rows);
    expect(out.map((g) => [g.key, g.students])).toEqual([["deep sea diver", 3], ["pilot", 2], ["fashion stylist", 1]]);
  });
  it("keeps the dates, and the wordings people used", () => {
    const g = groupGoalDemand(rows)[0];
    expect([g.firstAsked, g.lastAsked]).toEqual(["2026-11-01", "2026-11-03"]);
    expect(g.wordings).toContain("I want to become a deep sea diver");
  });
  it("counts one student once however many times they asked, and breaks ties by the most recent", () => {
    const again = [r("a b", "a b", "u1", "2026-11-01"), r("a b", "a b", "u1", "2026-11-02"), r("c d", "c d", "u2", "2026-11-09")];
    expect(groupGoalDemand(again).map((g) => [g.key, g.students])).toEqual([["c d", 1], ["a b", 1]]);
  });
  it("marks a goal covered only when every request for it is", () => {
    expect(groupGoalDemand([r("x", "x", "u1", "2026-11-01", "COVERED"), r("x", "x", "u2", "2026-11-01")])[0].covered).toBe(false);
    expect(groupGoalDemand([r("x", "x", "u1", "2026-11-01", "COVERED")])[0].covered).toBe(true);
  });
});
