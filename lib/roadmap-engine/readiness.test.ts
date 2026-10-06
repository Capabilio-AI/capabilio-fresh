import { describe, expect, it } from "vitest";
import { computeReadiness, READINESS_EXPLANATION } from "./readiness";
import type { CareerRequirement, StudentSkillInput } from "./types";

const req = (skillId: string, importance: CareerRequirement["importance"], targetLevel: number): CareerRequirement => ({ skillId, skillName: skillId, importance, targetLevel, stage: "JOB_READY", parentSkillId: null });
const v = (level: number): StudentSkillInput => ({ level, confidence: 0.7, verified: true, verifiedLevel: level, selfDeclaredLevel: null });
const claim = (level: number): StudentSkillInput => ({ level: Math.min(40, level), confidence: 0, verified: false, verifiedLevel: null, selfDeclaredLevel: Math.min(40, level) });
const R = [req("a", "CRITICAL", 80), req("b", "LOW", 50)];

describe("computeReadiness", () => {
  it("is 0 with no evidence and 100 when every target is met", () => {
    expect(computeReadiness(R, {})).toBe(0);
    expect(computeReadiness(R, { a: v(80), b: v(50) })).toBe(100);
    expect(computeReadiness(R, { a: v(100), b: v(100) })).toBe(100); // over-achieving is capped, never above 100
  });
  it("weights by importance: closing the critical skill moves it far more than the low one", () => {
    const critical = computeReadiness(R, { a: v(80) });
    const low = computeReadiness(R, { b: v(50) });
    expect(critical).toBe(80); // weights 4 and 1 -> 4/5
    expect(low).toBe(20);
  });
  it("counts partial progress proportionally", () => {
    expect(computeReadiness([req("a", "HIGH", 80)], { a: v(40) })).toBe(50);
  });
  it("verified evidence counts for more than a claim: a claim is capped at 40 and halved", () => {
    expect(computeReadiness([req("a", "HIGH", 80)], { a: v(40) })).toBe(50);
    expect(computeReadiness([req("a", "HIGH", 80)], { a: claim(80) })).toBe(25); // 40 -> 20 of 80
  });
  it("is 0 for a career with no requirements, and an integer", () => {
    expect(computeReadiness([], { a: v(80) })).toBe(0);
    expect(Number.isInteger(computeReadiness([req("a", "HIGH", 70), req("b", "MEDIUM", 60)], { a: v(33), b: v(41) }))).toBe(true);
  });
  it("documents its own formula for the 'How is this calculated?' popover", () => {
    expect(READINESS_EXPLANATION).toMatch(/importance/i);
    expect(READINESS_EXPLANATION).toMatch(/verified/i);
    expect(READINESS_EXPLANATION).toMatch(/self-declared|claimed/i);
  });
});
