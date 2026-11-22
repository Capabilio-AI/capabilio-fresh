import { afterEach, describe, expect, it, vi } from "vitest";
import { runOnServer } from "./run-client";

const reply = (status: number, body: Record<string, unknown>) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const noWait = { sleep: () => Promise.resolve() };
afterEach(() => vi.unstubAllGlobals());

describe("runOnServer", () => {
  it("tries again when the runner is busy, and returns the answer once it runs", async () => {
    const f = vi.fn().mockReturnValueOnce(reply(502, { error: "Code execution service is unavailable." })).mockReturnValueOnce(reply(503, {})).mockReturnValueOnce(reply(200, { stdout: "7\n" }));
    vi.stubGlobal("fetch", f);
    expect(await runOnServer("c", "x", "", noWait)).toEqual({ ok: true, text: "7\n", isError: false });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("gives up after three tries with a message that says the code was not run", async () => {
    const f = vi.fn().mockImplementation(() => reply(502, {}));
    vi.stubGlobal("fetch", f);
    const r = await runOnServer("c", "x", "", noWait);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toMatch(/not run/);
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("never retries a rate limit, a compile error or a bad request", async () => {
    const limited = vi.fn().mockImplementation(() => reply(429, {}));
    vi.stubGlobal("fetch", limited);
    expect(await runOnServer("c", "x", "", noWait)).toMatchObject({ ok: false });
    expect(limited).toHaveBeenCalledTimes(1);
    const compile = vi.fn().mockImplementation(() => reply(200, { compileError: "error: expected ;" }));
    vi.stubGlobal("fetch", compile);
    expect(await runOnServer("c", "x", "", noWait)).toEqual({ ok: true, text: "error: expected ;", isError: true });
    expect(compile).toHaveBeenCalledTimes(1);
    const bad = vi.fn().mockImplementation(() => reply(400, { error: "Unsupported language." }));
    vi.stubGlobal("fetch", bad);
    expect(await runOnServer("c", "x", "", noWait)).toEqual({ ok: false, message: "Unsupported language." });
    expect(bad).toHaveBeenCalledTimes(1);
  });
  it("retries when the network drops, then reports it", async () => {
    const f = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", f);
    expect(await runOnServer("c", "x", "", noWait)).toMatchObject({ ok: false, message: expect.stringMatching(/reach the server/) });
    expect(f).toHaveBeenCalledTimes(3);
  });
});
