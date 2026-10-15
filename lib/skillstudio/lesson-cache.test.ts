import { beforeEach, describe, expect, it } from "vitest";
import { cached, clearLessonCache } from "./lesson-cache";

beforeEach(clearLessonCache);

describe("lesson cache", () => {
  it("generates once and serves the rest from memory", async () => {
    let calls = 0;
    const make = async () => ++calls;
    expect(await cached("k", make)).toBe(1);
    expect(await cached("k", make)).toBe(1);
    expect(calls).toBe(1);
  });

  it("lets simultaneous requests share one generation", async () => {
    let calls = 0;
    const make = () => new Promise<number>((r) => setTimeout(() => r(++calls), 5));
    const all = await Promise.all([cached("k", make), cached("k", make), cached("k", make)]);
    expect(all).toEqual([1, 1, 1]);
  });

  it("does not remember a failure, so the next try can succeed", async () => {
    await expect(cached("k", async () => { throw new Error("model down"); })).rejects.toThrow("model down");
    expect(await cached("k", async () => "ok")).toBe("ok");
  });

  it("expires after a day", async () => {
    await cached("k", async () => "old", 0);
    expect(await cached("k", async () => "new", 25 * 60 * 60 * 1000)).toBe("new");
  });
});
