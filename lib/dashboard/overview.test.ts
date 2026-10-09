import { describe, expect, it } from "vitest";
import type { CareerProfile } from "@/lib/assess/career-profile";
import { buildOverview } from "./overview";

const skill = (name: string, score: number | null, targetLevel: number, weight = 1) =>
  ({ skillId: name, key: name, name, category: null, importance: "CORE", targetLevel, weight, score, confidence: "HIGH", evidenceCount: 3 }) as unknown as CareerProfile["skills"][number];

const profile = (over: Partial<CareerProfile> = {}): CareerProfile => ({
  status: "PROFILE_READY", unlocked: true, role: { id: "r", key: "ai", name: "AI/ML Engineer" },
  elo: { rating: 374, fromAssessment: -26, fromArena: 0, events: 1, history: [] }, readiness: 34, coverage: 0.5,
  skills: [skill("Python", 19, 80, 2), skill("ML", 35, 85, 3), skill("SQL", 90, 70), skill("NLP", null, 70, 5)],
  common: null, snapshotId: "s", updatedAt: null, ...over,
} as CareerProfile);

describe("buildOverview", () => {
  it("is null until the profile is unlocked with skills", () => {
    expect(buildOverview(profile({ unlocked: false }))).toBeNull();
    expect(buildOverview(profile({ skills: [] }))).toBeNull();
  });
  it("reports where the student stands and the distance to the goal", () => {
    const o = buildOverview(profile())!;
    expect(o).toMatchObject({ elo: 374, readiness: 34, pointsToGoal: 51, measured: 3, total: 4 });
    expect(o.tier.label).toBe("Rookie");
    expect(o.nextMilestone?.label).toBe("Core skills");
  });
  it("ranks laggards by weighted gap and strengths by score", () => {
    const o = buildOverview(profile())!;
    expect(o.lagging.map((s) => s.name)).toEqual(["ML", "Python"]);
    expect(o.strengths[0].name).toBe("SQL");
    expect(o.next).toMatchObject({ name: "ML", reason: "gap" });
  });
  it("asks to measure the most important unmeasured skill when nothing measured lags", () => {
    const o = buildOverview(profile({ skills: [skill("SQL", 90, 70), skill("NLP", null, 70, 5), skill("Stats", null, 60, 1)] }))!;
    expect(o.next).toMatchObject({ name: "NLP", reason: "measure" });
    expect(o.lagging).toEqual([]);
  });
  it("never goes negative once past the goal", () => {
    expect(buildOverview(profile({ readiness: 92 }))!.pointsToGoal).toBe(0);
    expect(buildOverview(profile({ readiness: 92 }))!.nextMilestone).toBeNull();
  });
});
