import { describe, expect, it } from "vitest";
import { runOnJudge0 } from "./judge0";

const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
process.env.JUDGE0_URL = "https://judge.test";

describe("runOnJudge0", () => {
  it("returns the program's output", async () => {
    const r = await runOnJudge0("python", "print(1)", "", reply({ stdout: "1\n", stderr: null, compile_output: null, message: null, status: { id: 3, description: "Accepted" } }));
    expect(r).toEqual({ stdout: "1\n", stderr: "", compileError: "" });
  });
  it("reports a compile error", async () => {
    const r = await runOnJudge0("c", "x", "", reply({ stdout: null, stderr: null, compile_output: "error: x", message: null, status: { id: 6, description: "Compilation Error" } }));
    expect(r.compileError).toBe("error: x");
  });
  it("reports a time limit", async () => {
    const r = await runOnJudge0("cpp", "x", "", reply({ stdout: null, stderr: null, compile_output: null, message: null, status: { id: 5, description: "Time Limit Exceeded" } }));
    expect(r.stderr).toBe("Time limit exceeded");
  });
  it("throws when the judge itself failed, so the caller retries instead of grading", async () => {
    await expect(runOnJudge0("java", "x", "", reply({ stdout: null, stderr: null, compile_output: null, message: null, status: { id: 13, description: "Internal Error" } }))).rejects.toThrow("busy");
  });
  it("rejects an unknown language", async () => {
    await expect(runOnJudge0("cobol", "x", "")).rejects.toThrow("Unsupported");
  });
});
