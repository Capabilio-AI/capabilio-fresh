import { describe, expect, it } from "vitest";
import { runOnJudge0 } from "./judge0";

// Judge0 is asked for base64, so the fake answers in base64 too: string fields are encoded the way the real service encodes them
const enc = (v: unknown) => (typeof v === "string" ? Buffer.from(v, "utf8").toString("base64") : v);
const reply = (body: Record<string, unknown>, status = 200) =>
  (async () => new Response(JSON.stringify(Object.fromEntries(Object.entries(body).map(([k, v]) => [k, ["stdout", "stderr", "compile_output", "message"].includes(k) ? enc(v) : v]))), { status })) as unknown as typeof fetch;
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
  it("sends the code and input as base64", async () => {
    let sent: { source_code: string; stdin: string } | null = null;
    const spy = (async (_u: unknown, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ stdout: null, stderr: null, compile_output: null, message: null, status: { id: 3, description: "Accepted" } })); }) as unknown as typeof fetch;
    await runOnJudge0("python", "print('é')", "3 4\n", spy);
    expect(Buffer.from(sent!.source_code, "base64").toString("utf8")).toBe("print('é')");
    expect(Buffer.from(sent!.stdin, "base64").toString("utf8")).toBe("3 4\n");
  });
  it("does not crash when a program prints bytes that are not valid text", async () => {
    const bad = (async () => new Response(JSON.stringify({ stdout: Buffer.from([0x61, 0xff, 0x62]).toString("base64"), stderr: null, compile_output: null, message: null, status: { id: 3, description: "Accepted" } }))) as unknown as typeof fetch;
    const r = await runOnJudge0("c", "x", "", bad);
    expect(r.stdout).toBe("a\uFFFDb");
  });
  it("throws busy, not a crash, when the judge answers without a status", async () => {
    const noStatus = (async () => new Response(JSON.stringify({ error: "some attributes for this submission cannot be converted to UTF-8" }), { status: 201 })) as unknown as typeof fetch;
    await expect(runOnJudge0("cpp", "x", "", noStatus)).rejects.toThrow("busy");
  });
  it("rejects an unknown language", async () => {
    await expect(runOnJudge0("cobol", "x", "")).rejects.toThrow("Unsupported");
  });
});
