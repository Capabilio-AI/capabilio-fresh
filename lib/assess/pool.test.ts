import { describe, expect, it } from "vitest";
import { CAREER_BANK_CAP, CAREER_LEVEL } from "./config";
import { careerPoolTarget, chooseFrom, type PoolPick } from "./pool";

const pick = (id: string, difficulty: PoolPick["difficulty"]): PoolPick => ({ id, content_hash: id, skill_id: "s", section: null, skill_name: "S", category: null, difficulty, question_type: "concept", question_text: "q", options: ["a", "b"], estimated_seconds: 30 });

describe("career assessment is basics only", () => {
  it("is fixed at the basic level", () => {
    expect(CAREER_LEVEL).toBe("EASY");
  });
  it("sizes the pool for basic questions only", () => {
    const t = careerPoolTarget(20);
    expect(t.EASY).toBeGreaterThanOrEqual(CAREER_BANK_CAP / 20);
    expect(t.MEDIUM).toBe(0);
    expect(t.HARD).toBe(0);
  });
  it("never serves a harder question when a basic one is missing (strict)", () => {
    const rows = [pick("m", "MEDIUM"), pick("h", "HARD")];
    expect(chooseFrom(rows, "CAREER", "s", "EASY", false, true)).toBeNull();
    expect(chooseFrom(rows, "CAREER", "s", "EASY", false, false)).not.toBeNull(); // the common assessment may still fall back
  });
  it("serves the basic question when there is one", () => {
    expect(chooseFrom([pick("m", "MEDIUM"), pick("e", "EASY")], "CAREER", "s", "EASY", false, true)?.id).toBe("e");
  });
});
