import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExplainWork } from "./ExplainWork";
import type { PublicAttempt } from "../workstations/WorkstationShell";

const attempt: PublicAttempt = {
  attemptId: "a1", assignedAt: "2026-10-15T00:00:00Z", status: "explaining", submissionCount: 1, lastGrade: null, area: { key: "sql", name: "SQL" },
  explain: { submission: "SQL they wrote:\nSELECT COUNT(DISTINCT order_id) FROM orders", checks: ["Query runs", "All expected values present"], attempts: 0, maxAttempts: 2 },
  challenge: { id: "c1", title: "Fix: the order count is far too high", category: "SQL", difficulty: "medium", time_limit_minutes: 12, scenario: "The dashboard overcounts delivered orders.", objective: "Fix it.", requester: "Priya Nair · Sales Operations Lead", skill_tags: ["SQL"], tool_type: "sql_workspace", content: {} },
};
const html = (over: Partial<PublicAttempt> = {}) => renderToStaticMarkup(createElement(ExplainWork, { attempt: { ...attempt, ...over }, onDone: () => {} }));

describe("ExplainWork", () => {
  it("shows the completed task, what the user handed in, and what the interview unlocks", () => {
    const out = html();
    expect(out).toContain("Task solved: Fix: the order count is far too high");
    expect(out).toContain("Now explain your work to earn your rating");
    expect(out).toContain("+12 ELO");
    expect(out).toContain("portfolio and your skill graph");
    expect(out).toContain("The request from Priya Nair");
    expect(out).toContain("The dashboard overcounts delivered orders.");
    expect(out).toContain("SELECT COUNT(DISTINCT order_id)");
    expect(out).toContain("Checks passed:");
    expect(out).toContain("Start the interview");
  });

  it("states the pass mark and the number of tries, and offers an honest skip", () => {
    const out = html();
    expect(out).toContain("You have 2 tries");
    expect(out).toContain("You need 50 out of 100");
    expect(out).toContain("Skip, without a rating");
    expect(html({ explain: { ...attempt.explain!, attempts: 1 } })).toContain("You have one try left");
  });
});
