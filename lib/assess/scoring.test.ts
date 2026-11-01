import { describe, expect, it } from "vitest";
import { buildSkillResults, computeReadiness, SCREEN_CAP, type RoleSkill, type SourcedObs } from "./scoring";

const role = (n: number): RoleSkill[] =>
  Array.from({ length: n }, (_, i) => ({ skillId: `s${i}`, key: `S${i}`, name: `Skill ${i}`, category: null, importance: "HIGH" as const, targetLevel: 80, weight: 1 }));
const mcq = (n: number): SourcedObs[] => Array.from({ length: n }, () => ({ difficulty: "HARD" as const, correct: true }));
const arena = (n: number, difficulty: SourcedObs["difficulty"] = "MEDIUM"): SourcedObs[] => Array.from({ length: n }, () => ({ difficulty, correct: true, practical: true }));

describe("proof-capped readiness", () => {
  it("a perfect screening run cannot lift a skill past the screening cap", () => {
    const [r] = buildSkillResults(role(1), { s0: mcq(6) });
    expect(r.score).toBe(SCREEN_CAP);
    expect(r.proof).toBe(0);
  });

  it("skills nobody measured count against readiness, not out of it", () => {
    const out = computeReadiness(buildSkillResults(role(10), { s0: mcq(5), s1: mcq(5) }));
    expect(out.coverage).toBe(20);
    expect(out.readiness).toBeLessThan(15); // was ~50% when only the measured skills were averaged
  });

  it("one Arena task on one skill is progress, never a 90", () => {
    const [r] = buildSkillResults(role(1), { s0: [...mcq(4), ...arena(1)] });
    expect(r.score).toBe(55);
    expect(computeReadiness(buildSkillResults(role(8), { s0: [...mcq(4), ...arena(1)] })).readiness).toBeLessThan(10);
  });

  it("three medium tasks prove a skill to its target and two do not", () => {
    const [two] = buildSkillResults(role(1), { s0: [...mcq(4), ...arena(2)] });
    const [three] = buildSkillResults(role(1), { s0: [...mcq(4), ...arena(3)] });
    expect(two.score).toBeLessThan(80);
    expect(three.score).toBeGreaterThanOrEqual(80);
  });

  it("a hard task counts for more than an easy one", () => {
    const [easy] = buildSkillResults(role(1), { s0: arena(1, "EASY") });
    const [hard] = buildSkillResults(role(1), { s0: arena(1, "HARD") });
    expect(hard.proof).toBeGreaterThan(easy.proof);
  });
});

describe("proven readiness", () => {
  it("is zero for a student who has only answered questions, however well", () => {
    const out = computeReadiness(buildSkillResults(role(10), Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`s${i}`, mcq(6)]))));
    expect(out.coverage).toBe(100);
    expect(out.readiness).toBeGreaterThan(40); // screened: where they start
    expect(out.proven).toBe(0);
  });

  it("counts only the skills a passed task backs, and grows with each", () => {
    const ev = (n: number) => Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`s${i}`, i < n ? [...mcq(4), ...arena(3)] : mcq(4)]));
    const one = computeReadiness(buildSkillResults(role(10), ev(1))).proven;
    const five = computeReadiness(buildSkillResults(role(10), ev(5))).proven;
    expect(one).toBeGreaterThan(0);
    expect(five).toBeGreaterThan(one);
    expect(computeReadiness(buildSkillResults(role(10), ev(10))).proven).toBeGreaterThan(90);
  });
});
