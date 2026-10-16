import { describe, expect, it } from "vitest";
import { runInSandbox } from "./sandbox";

describe("sandbox", () => {
  it("runs a function on every case and reports errors per case", async () => {
    const out = await runInSandbox("function add(a, b) { if (a < 0) throw new Error('neg'); return a + b; }", "add", [[1, 2], [-1, 2]]);
    expect(out).toEqual([{ ok: true, value: 3 }, { ok: false, error: "neg" }]);
  });
  it("stops an endless loop", async () => {
    await expect(runInSandbox("function f() { while (true) {} }", "f", [[]], 300)).rejects.toThrow();
  });
  it("reports a missing function and a syntax error", async () => {
    await expect(runInSandbox("function g() {}", "f", [[]])).rejects.toThrow(/missing function/);
    await expect(runInSandbox("function (", "f", [[]])).rejects.toThrow();
  });
  it("cannot reach the process or build code from strings", async () => {
    const probe = await runInSandbox("function f() { return typeof process + typeof require; }", "f", [[]]);
    expect(probe[0].value).toBe("undefinedundefined");
    const viaFunction = await runInSandbox("function f() { return (function(){}).constructor('return typeof process')(); }", "f", [[]]);
    expect(viaFunction[0].ok).toBe(false);
  });
});
