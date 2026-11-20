import { describe, expect, it } from "vitest";
import type { CareerProfile } from "@/lib/assess/career-profile";
import { planAInsights } from "./plan-a-insights";

const skill = (name: string, score: number | null, importance = "HIGH", targetLevel = 70) => ({ skillId: name, key: name, name, category: null, importance, targetLevel, weight: 1, score, confidence: "HIGH", evidenceCount: 1, proof: 0 }) as CareerProfile["skills"][number];
const profile = (over: Partial<CareerProfile> = {}): CareerProfile => ({
  status: "PROFILE_READY", unlocked: true, role: { id: "r", key: "fs", name: "Full Stack Developer" },
  elo: { rating: 512, fromAssessment: 112, fromArena: 0, events: 1, history: [] }, readiness: 41, proven: 12, coverage: 60,
  skills: [skill("SQL", 90), skill("React", 40, "CRITICAL"), skill("Docker", null, "LOW"), skill("Git", 80, "MEDIUM")],
  common: [{ section: "a", label: "Communication", score: 71.4, confidence: "HIGH", correct: 10, total: 14 }, { section: "b", label: "Aptitude", score: null, confidence: "LOW", correct: 0, total: 0 }],
  snapshotId: "s", updatedAt: "2026-11-17", ...over,
});

describe("planAInsights", () => {
  it("is null when there is no main role", () => {
    expect(planAInsights(profile({ role: null }))).toBeNull();
  });
  it("lists strongest measured skills best first and gaps most important first, unmeasured included", () => {
    const i = planAInsights(profile())!;
    expect(i.strongest.map((s) => s.name)).toEqual(["SQL", "Git", "React"]);
    expect(i.gaps.map((g) => g.name)).toEqual(["React", "Docker"]);
    expect(i.gaps[1]).toMatchObject({ score: null, importance: "LOW" });
    expect([i.measuredSkills, i.totalSkills]).toEqual([3, 4]);
  });
  it("keeps only scored common sections, rounded", () => {
    expect(planAInsights(profile())!.common).toEqual([{ label: "Communication", score: 71 }]);
  });
  it("says there is no assessment yet rather than inventing numbers", () => {
    const i = planAInsights(profile({ elo: null, readiness: null, skills: [], common: null }))!;
    expect(i).toMatchObject({ hasAssessment: false, rating: null, strongest: [], gaps: [], common: [] });
  });
});
