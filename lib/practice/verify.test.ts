import { describe, expect, it } from "vitest";
import type { GeneratedExercise } from "./practice";
import { checkAgainstTests, runReliably, verifyExercise, type Runner } from "./verify";

const fast = { sleep: async () => {} };

const tests = [{ input: "2\n", expected: "4", hidden: false }, { input: "3\n", expected: "9", hidden: false }, { input: "10\n", expected: "100", hidden: true }];
const ex: GeneratedExercise = { title: "Square", instructions: "Read n and print n squared, as an integer.", starterCode: "# your code\n", solution: "SOLUTION", tests };

/** A pretend runner: the program text decides what it prints. */
const runner = (programs: Record<string, (input: string) => string>): Runner => async (_lang, code, stdin) => {
  const f = programs[code];
  if (!f) return { stdout: "", stderr: "", compileError: "boom" };
  return { stdout: f(stdin), stderr: "", compileError: "" };
};
const square = (i: string) => String(Number(i.trim()) ** 2);

describe("verifyExercise", () => {
  it("keeps an exercise whose solution passes every test and whose starter does not", async () => {
    const r = await verifyExercise(ex, "python", runner({ SOLUTION: square, "# your code\n": () => "" }), fast);
    expect(r).toEqual({ ok: true });
  });
  it("throws away an exercise whose solution is wrong on any test, including a hidden one", async () => {
    const r = await verifyExercise(ex, "python", runner({ SOLUTION: (i) => (i.trim() === "10" ? "99" : square(i)), "# your code\n": () => "" }), fast);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/solution failed/i);
  });
  it("throws away an exercise whose solution does not even compile or run", async () => {
    const r = await verifyExercise(ex, "python", runner({}), fast);
    expect(r.ok === false && r.reason).toMatch(/solution failed/i);
  });
  it("throws away an exercise the starter code already solves", async () => {
    const r = await verifyExercise(ex, "python", runner({ SOLUTION: square, "# your code\n": square }), fast);
    expect(r.ok === false && r.reason).toMatch(/starter/i);
  });
});

describe("checkAgainstTests", () => {
  it("reports each visible test with what came out, and hidden ones only as pass or fail", async () => {
    const out = await checkAgainstTests("python", "STUDENT", tests, runner({ STUDENT: (i) => (i.trim() === "2" ? "4" : "0") }), fast);
    expect(out.passed).toBe(false);
    expect(out.results.map((r) => r.pass)).toEqual([true, false, false]);
    expect(out.results[1]).toMatchObject({ hidden: false, input: "3\n", expected: "9", got: "0" });
    expect(out.results[2]).toEqual({ hidden: true, pass: false });
    expect(JSON.stringify(out.results[2])).not.toContain("100");
  });
  it("passes when every test matches, and shows a compile error rather than a blank", async () => {
    expect((await checkAgainstTests("python", "STUDENT", tests, runner({ STUDENT: square }), fast)).passed).toBe(true);
    const bad = await checkAgainstTests("python", "NOPE", tests, runner({}), fast);
    expect(bad.passed).toBe(false);
    expect(bad.error).toBe("boom");
  });
});

describe("a busy runner is not a wrong answer", () => {
  const flaky = (failures: number): Runner => {
    let n = 0;
    return async () => { if (n++ < failures) throw new Error("Code execution service is busy"); return { stdout: "4", stderr: "", compileError: "" }; };
  };
  it("retries a run that threw, then succeeds", async () => {
    expect(await runReliably(flaky(2), "python", "x", "", fast)).toEqual({ stdout: "4", stderr: "", compileError: "" });
  });
  it("gives up after the retries and says nothing ran", async () => {
    expect(await runReliably(flaky(9), "python", "x", "", fast)).toBeNull();
  });
  it("reports infrastructure trouble, not a failed exercise or a failed student", async () => {
    const down: Runner = async () => { throw new Error("busy"); };
    const v = await verifyExercise(ex, "python", down, fast);
    expect(v).toMatchObject({ ok: false, infra: true });
    const c = await checkAgainstTests("python", "code", tests, down, fast);
    expect(c).toMatchObject({ passed: false, unavailable: true, results: [] });
  });
});
