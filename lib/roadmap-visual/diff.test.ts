import { describe, expect, it } from "vitest";
import { describeChange, diffNodes, memoOf } from "./diff";
import { buildGraph } from "./graph-build";
import { makeContext } from "./graph.fixture";

const ev = (level: number) => [{ kind: "ASSESSMENT" as const, level, observedAt: new Date("2026-10-01"), label: "x" }];

describe("diffNodes", () => {
  const before = buildGraph(makeContext({}, { "s-sql": ev(40) })).nodes;
  const after = buildGraph(makeContext({}, { "s-sql": ev(70), "s-stats": ev(50) })).nodes;
  it("says nothing on a first visit", () => expect(diffNodes(null, after)).toEqual([]));
  it("reports a rise, a new assessment and nothing for unchanged topics", () => {
    const changes = diffNodes(memoOf(before), after);
    expect(changes.map((c) => [c.title, c.kind])).toEqual([["SQL", "LEVEL_UP"], ["Statistics", "ASSESSED"]]);
    expect(changes.map(describeChange)).toEqual(["SQL: 40 → 70", "Statistics: now assessed at 50"]);
  });
  it("reports a drop and a status-only change", () => {
    const down = diffNodes(memoOf(after), before);
    expect(down.some((c) => c.kind === "LEVEL_DOWN" && c.title === "SQL")).toBe(true);
    const marked = buildGraph(makeContext({ userStates: new Map([["joins", { status: "LEARNING" as const, reason: null }]]) }, { "s-sql": ev(40) })).nodes;
    expect(diffNodes(memoOf(before), marked).map((c) => [c.title, c.kind])).toContainEqual(["Joins", "STATUS"]);
  });
});
