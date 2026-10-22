import { describe, expect, it } from "vitest";
import { runInSandbox } from "./sandbox";

// Reference solutions are written by the AI generator, so a hostile or buggy one must not reach the host.
describe("code sandbox boundary", () => {
  const attempt = async (body: string) => (await runInSandbox(`function f() { ${body} }`, "f", [[]]))[0];

  it("cannot reach process, require or the module system", async () => {
    for (const body of ["return typeof process;", "return typeof require;", "return typeof module;", "return typeof globalThis.process;"]) {
      const r = await attempt(body);
      expect(r.ok && r.value, body).toBe("undefined");
    }
  });

  it("cannot build code from strings through the constructor chain", async () => {
    for (const body of ["return this.constructor.constructor('return process')();", "return (function(){}).constructor('return process')();", "return eval('1+1');", "return new Function('return 1')();"]) {
      const r = await attempt(body);
      expect(r.ok, body).toBe(false);
    }
  });
});
