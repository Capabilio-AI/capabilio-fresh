import { afterEach, describe, expect, it } from "vitest";
import { mockAdapter, setAdapterForTest } from "@/lib/ai/llm";
import { judge, mapLimit, normalizeOutput, outputsMatch, type Runner } from "./judge";
import { verifyProblem } from "./generate";
import { topicsFor } from "./weekly";
import type { GeneratedProblem } from "./problem";

const deps = { env: { LLM_PROVIDER: "mock", LLM_MODEL: "m" }, sleep: async () => {}, random: () => 0, attempts: 1 };
afterEach(() => setAdapterForTest("mock", null));

// the "code" under test is just a tag: the fake runner maps (tag, input) to output
const run = (table: Record<string, (stdin: string) => string>): Runner => async (_l, code, stdin) => ({ stdout: table[code]?.(stdin) ?? "", stderr: "", compileError: "" });
const sum = (s: string) => String(s.trim().split(/\s+/).map(Number).reduce((a, b) => a + b, 0));

const problem: GeneratedProblem = {
  title: "Sum of numbers", category: "Math", difficulty: "easy",
  statement: "Read a line of integers and print their sum. Every number fits in a normal integer.",
  input_format: "One line of space separated integers.", output_format: "A single integer.", constraints: ["1 <= n <= 100"],
  sample_inputs: ["1 2 3", "10 20"], sample_explanations: ["1+2+3 is 6", "10+20 is 30"],
  hidden_inputs: ["5", "0 0 0", "-1 1 7", "100 200 300 400"],
  reference_solution: "REF", starter_python: "STARTER", starter_c: "int main(){return 0;}", skill_tags: ["math"],
};

describe("output comparison", () => {
  it("ignores trailing spaces and edge blank lines only", () => {
    expect(normalizeOutput("a \r\nb\n\n")).toBe("a\nb");
    expect(outputsMatch("6\n", " 6")).toBe(true);
    expect(outputsMatch("1 2", "1  2")).toBe(false);
  });
  it("mapLimit never exceeds its concurrency", async () => {
    let live = 0, peak = 0;
    await mapLimit([1, 2, 3, 4, 5, 6], 2, async () => { peak = Math.max(peak, ++live); await new Promise((r) => setTimeout(r, 2)); live--; });
    expect(peak).toBe(2);
  });
});

describe("judge", () => {
  it("passes only the tests the code gets right and treats a runner failure as a fail", async () => {
    const tests = [{ input: "1 2", output: "3" }, { input: "5 5", output: "10" }];
    const wrong = run({ BAD: () => "3" });
    const v = await judge("python", "BAD", tests, wrong);
    expect(v.map((x) => x.passed)).toEqual([true, false]);
    const down = await judge("python", "X", tests, async () => { throw new Error("down"); });
    expect(down.every((x) => !x.passed && x.error.includes("unavailable"))).toBe(true);
  });
});

describe("verifyProblem", () => {
  const solver = (solution: string) => setAdapterForTest("mock", mockAdapter(() => ({ solution })));
  it("keeps a problem whose independent solution reproduces the reference outputs, with outputs from running the reference", async () => {
    solver("INDEP");
    const out = await verifyProblem(problem, deps, run({ REF: sum, INDEP: sum, STARTER: () => "" }));
    if (!out.ok) throw new Error(out.reason);
    expect(out.ok && out.value.tests.map((t) => t.output)).toEqual(["6", "30", "5", "0", "7", "1000"]);
    expect(out.ok && out.value.sampleCount).toBe(2);
  });
  it("rejects when the independent solution disagrees, or the starter already solves it", async () => {
    solver("INDEP");
    expect((await verifyProblem(problem, deps, run({ REF: sum, INDEP: () => "0", STARTER: () => "" }))).ok).toBe(false);
    solver("INDEP");
    expect((await verifyProblem(problem, deps, run({ REF: sum, INDEP: sum, STARTER: sum }))).ok).toBe(false);
  });
  it("rejects a reference that fails or a test set where every answer is the same", async () => {
    solver("INDEP");
    expect((await verifyProblem(problem, deps, run({ REF: () => "", INDEP: sum, STARTER: () => "" }))).ok).toBe(false);
    solver("INDEP");
    expect((await verifyProblem(problem, deps, run({ REF: () => "7", INDEP: () => "7", STARTER: () => "" }))).ok).toBe(false);
  });
});

describe("topicsFor", () => {
  it("differs between consecutive weeks", () => {
    expect(topicsFor("2026-10-11")).not.toEqual(topicsFor("2026-10-18"));
    expect(topicsFor("2026-10-11")).toHaveLength(5);
  });
});
