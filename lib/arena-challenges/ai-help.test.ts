import { describe, expect, it } from "vitest";
import { leaksAnswer, withheldReply } from "./ai-help-rules";
import { buildPrompt } from "./ai-help";

const numeric = { checkType: "NUMERIC_ANSWER" as const, config: { expected: 37.5 } };
const choice = { checkType: "CHOICE_ANSWER" as const, config: { correct: "Slump test" } };

describe("leaksAnswer", () => {
  it("catches a numeric answer written in the usual ways", () => {
    expect(leaksAnswer("So the moment comes out to 37.5 kN·m.", [numeric])).toBe(true);
    expect(leaksAnswer("You should get 13,824 W", [{ checkType: "NUMERIC_ANSWER", config: { expected: 13824 } }])).toBe(true);
    expect(leaksAnswer("about 13824 watts", [{ checkType: "NUMERIC_ANSWER", config: { expected: 13824 } }])).toBe(true);
  });
  it("does not trip on unrelated or merely similar numbers", () => {
    expect(leaksAnswer("The load is 12 kN/m over 5 m; try w·L²/8.", [numeric])).toBe(false);
    expect(leaksAnswer("Check 137.55 and 375", [numeric])).toBe(false);
    expect(leaksAnswer("Use 2 supports", [{ checkType: "NUMERIC_ANSWER", config: { expected: 2 } }])).toBe(false); // tiny whole numbers are not secrets
  });
  it("catches the correct option, the ground-truth query and required file text", () => {
    expect(leaksAnswer("The answer is the slump test.", [choice])).toBe(true);
    expect(leaksAnswer("Think about how workability is measured.", [choice])).toBe(false);
    expect(leaksAnswer("Try: SELECT  SUM(amount)\nFROM orders", [{ checkType: "QUERY_RESULT", config: { groundTruthQuery: "select sum(amount) from orders" } }])).toBe(true);
    expect(leaksAnswer('Add <label for="email"> to the form', [{ checkType: "FILE_STATE", config: { contains: ['<label for="email">'] } }])).toBe(true);
  });
  it("lets an ordinary explanation through", () => {
    expect(leaksAnswer("Think about equilibrium: each support carries half of the total load. What is the total load?", [numeric, choice])).toBe(false);
  });
});

describe("buildPrompt", () => {
  const base = { challenge: { title: "Beam", ticket_brief: "A beam spans 5 m." }, steps: [{ step_order: 1, title: "Reaction", instruction: "Find it." }], skills: ["Problem Solving"] };
  it("shows only visible failed checks and never anything secret", () => {
    const prompt = buildPrompt({ ...base, finished: true, results: [{ stepId: null, label: "Reaction is right", visible: true, passed: false }, { stepId: null, label: "Hidden check", visible: false, passed: false }] }, "why?");
    expect(prompt).toContain("Reaction is right");
    expect(prompt).not.toContain("Hidden check");
    expect(prompt).toContain("<student_question>\nwhy?\n</student_question>");
  });
  it("caps and defaults the question", () => {
    expect(buildPrompt({ ...base, finished: false, results: [] }, "x".repeat(1000))).not.toContain("x".repeat(301));
    expect(buildPrompt({ ...base, finished: false, results: [] }, "")).toContain("I'm stuck");
  });
});

describe("withheldReply", () => {
  it("names what to revisit from real data only", () => {
    expect(withheldReply(["Reaction"], ["Problem Solving"])).toMatch(/Revisit: Reaction\..*Problem Solving/);
    expect(withheldReply([], [])).toMatch(/can't give that away/);
  });
});
