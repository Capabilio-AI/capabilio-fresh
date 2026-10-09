import { afterEach, describe, expect, it } from "vitest";
import { mockAdapter, setAdapterForTest } from "@/lib/ai/llm";
import { generateBatch, verifyBatch, buildPrompt, type CareerSlot, type LlmDeps } from "./generate";
import type { ValidQuestion } from "./validate";

const slot: CareerSlot = { kind: "CAREER", careerId: "c1", careerKey: "data-analyst", careerName: "Data Analyst", skillId: "s1", skillKey: "SKILL_SQL", skillName: "SQL", skillDescription: null, category: "Data" };
const q = (n: number, answer = 0) => ({
  question: `A retail analyst needs report number ${n}: average basket value for returning customers last quarter. Which query is correct?`,
  options: [`SELECT AVG(v) FROM t${n}`, `SELECT SUM(v) FROM t${n}`, `SELECT COUNT(*) FROM t${n}`, `SELECT MAX(v) FROM t${n}`],
  skill: "SQL", skillId: "SKILL_SQL", careerRole: "Data Analyst", difficulty: "MEDIUM", type: "sql_query",
  correctAnswer: [`SELECT AVG(v) FROM t${n}`, `SELECT SUM(v) FROM t${n}`, `SELECT COUNT(*) FROM t${n}`, `SELECT MAX(v) FROM t${n}`][answer],
  explanation: "AVG of the filtered rows is the mean basket value; the others compute a total, a count or a maximum instead.",
  estimatedTimeSeconds: 60,
});
const deps = (): LlmDeps => ({ env: { LLM_PROVIDER: "mock", LLM_MODEL: "m" }, sleep: async () => {}, random: () => 0, attempts: 1 });
afterEach(() => setAdapterForTest("mock", null));

/** one mock "provider" that plays both the generator and the independent solver */
function pin(generated: unknown[], picks: Record<number, number> = {}, verifierDown = false) {
  const solverOf = (user: string) => {
    const items = JSON.parse(user) as { id: number; options: string[] }[];
    return { answers: items.map((i) => ({ id: i.id, choice: i.options[picks[i.id] ?? 0] })) };
  };
  const a = mockAdapter((req) => {
    if (req.system.includes("careful expert")) {
      if (verifierDown) throw Object.assign(new Error("down"), { kind: "provider_down", retryable: true });
      return solverOf(req.user);
    }
    return { questions: generated };
  });
  setAdapterForTest("mock", a);
  return a;
}

describe("generateBatch", () => {
  it("keeps only questions that pass schema, semantics and independent verification, and records provenance", async () => {
    pin([q(1), q(2), { ...q(3), correctAnswer: "SELECT nothing" }, { question: "too short" }], { 1: 2 });
    const out = await generateBatch({ slot, difficulty: "MEDIUM", count: 4, studentLevel: "fresher", avoid: [] }, deps());
    expect(out.valid).toHaveLength(1); // q2: verifier disagreed; q3 bad key; 4th malformed
    expect(out.valid[0].question).toContain("report number 1");
    expect(out.rejected.join(" ")).toMatch(/not exactly one|schema|verification/);
    expect(out.provenance).toMatchObject({ provider: "mock", model: "m", promptVersion: "question.v2" });
  });

  it("never returns anything from non-JSON output", async () => {
    setAdapterForTest("mock", mockAdapter(() => "Sure! Here are your questions:"));
    await expect(generateBatch({ slot, difficulty: "MEDIUM", count: 4, studentLevel: "fresher", avoid: [] }, { ...deps(), repairs: 0 })).rejects.toMatchObject({ kind: "invalid_output" });
  });

  it("stores nothing when the verifier call itself fails", async () => {
    pin([q(1)], {}, true);
    await expect(generateBatch({ slot, difficulty: "MEDIUM", count: 1, studentLevel: "fresher", avoid: [] }, deps())).rejects.toBeTruthy();
  });
});

describe("verifyBatch", () => {
  it("ignores whitespace/case when comparing the independent answer to the key", async () => {
    setAdapterForTest("mock", mockAdapter(() => ({ answers: [{ id: 0, choice: "a  x" }] })));
    const v = [{ ...q(1), options: ["A x", "b", "c", "d"], correctIndex: 0 }] as unknown as ValidQuestion[];
    expect((await verifyBatch(v, deps())).kept).toHaveLength(1);
  });
});

describe("buildPrompt", () => {
  it("asks for realistic scenarios, names the exact skill and difficulty, and carries the avoid-list", () => {
    const p = buildPrompt({ slot, difficulty: "HARD", count: 4, studentLevel: "fresher", avoid: ["Which query counts rows?"] });
    expect(p.system).toMatch(/PROFESSIONAL SCENARIO/);
    expect(p.user).toContain("SKILL_ID: SKILL_SQL");
    expect(p.user).toContain("DIFFICULTY: HARD");
    expect(p.user).toContain("Which query counts rows?");
    expect(p.expectation).toMatchObject({ skillKey: "SKILL_SQL", difficulty: "HARD" });
  });
});
