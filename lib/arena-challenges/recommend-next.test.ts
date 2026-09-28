import { describe, expect, it } from "vitest";
import { recommendNextChallenge } from "./recommend-next";

function challenge(id: string, difficulty: "easy" | "medium" | "hard", createdAt: string) {
  return { id, difficulty, created_at: createdAt };
}

describe("recommendNextChallenge", () => {
  it("returns null when every challenge is already solved", () => {
    const pool = [challenge("a", "easy", "2026-01-01T00:00:00Z")];
    expect(recommendNextChallenge(pool, new Set(["a"]))).toBeNull();
  });

  it("returns null for an empty pool", () => {
    expect(recommendNextChallenge([], new Set())).toBeNull();
  });

  it("prefers the easiest unsolved challenge, not just the first in the array", () => {
    const pool = [challenge("hard1", "hard", "2026-01-01T00:00:00Z"), challenge("easy1", "easy", "2026-01-02T00:00:00Z")];
    expect(recommendNextChallenge(pool, new Set())?.id).toBe("easy1");
  });

  it("breaks a difficulty tie by the older challenge", () => {
    const pool = [challenge("newer", "easy", "2026-02-01T00:00:00Z"), challenge("older", "easy", "2026-01-01T00:00:00Z")];
    expect(recommendNextChallenge(pool, new Set())?.id).toBe("older");
  });

  it("skips solved challenges entirely, never re-recommending them", () => {
    const pool = [challenge("solved", "easy", "2026-01-01T00:00:00Z"), challenge("open", "medium", "2026-01-02T00:00:00Z")];
    expect(recommendNextChallenge(pool, new Set(["solved"]))?.id).toBe("open");
  });
});
