import { describe, expect, it, vi } from "vitest";
import { inBackground } from "./background";

describe("inBackground", () => {
  it("still runs the task outside a request scope, and swallows its failure", async () => {
    const ok = vi.fn(async () => {});
    inBackground(ok);
    await Promise.resolve();
    expect(ok).toHaveBeenCalledOnce();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    inBackground(async () => { throw new Error("boom"); });
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
