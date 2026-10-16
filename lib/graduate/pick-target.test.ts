import { describe, expect, it } from "vitest";
import type { PassportSkill } from "@/lib/passport/badges";
import { pickTarget } from "./pick-target";

const skill = (id: string, status: PassportSkill["status"], practiceLevel: number | null, extra: Partial<PassportSkill> = {}): PassportSkill => ({
  skillId: id, name: id.toUpperCase(), badge: null, status, practiceCount: practiceLevel ? 1 : 0, practiceLevel, baselineLevel: null, baselineLabel: null, evidence: [], lastWorkAt: null, next: { level: "Foundation", moreItems: 1, morePoints: 10 }, ...extra,
});

describe("pickTarget", () => {
  const area = (id: string) => (id === "b" ? "rest-api" : null);
  it("prefers the skill already started and closest to a badge", () => {
    const t = pickTarget([skill("a", "baseline", null), skill("b", "practising", 15), skill("c", "practising", 5)], area);
    expect(t).toMatchObject({ skillId: "b", areaKey: "rest-api" });
    expect(t!.progress).toBeCloseTo(15 / 20);
  });
  it("then a skill only the assessment has seen, then anything untouched", () => {
    expect(pickTarget([skill("n", "not-assessed", null), skill("a", "baseline", null)], area)?.skillId).toBe("a");
    expect(pickTarget([skill("n", "not-assessed", null)], area)?.skillId).toBe("n");
  });
  it("ignores skills that already have a badge, and returns nothing when all are earned", () => {
    const earned = skill("e", "earned", 80, { badge: { skillId: "e", name: "E", level: "Advanced", provisional: false, evidenceCount: 3, earnedAt: null, levelDates: {}, evidence: [] }, next: null });
    expect(pickTarget([earned], area)).toBeNull();
    expect(pickTarget([earned, skill("a", "baseline", null)], area)?.skillId).toBe("a");
  });
});
