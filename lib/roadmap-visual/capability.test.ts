import { describe, expect, it } from "vitest";
import { ARENA_POINTS_PER_PASS, FORMULA_VERSION, HALF_LIFE_DAYS, MASTERY_PROOFS, MAX_WITHOUT_INTERVIEW, SELF_DECLARED_CAP, proofCeiling, recencyFactor, scoreSkill, type EvidenceInput } from "./capability";

const NOW = new Date("2026-10-07T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const ev = (over: Partial<EvidenceInput> & Pick<EvidenceInput, "kind">): EvidenceInput => ({ label: "x", observedAt: NOW, level: 60, ...over });

describe("scoreSkill: honesty about missing evidence", () => {
  it("has NO level with no evidence (never 0, never verified)", () => {
    const s = scoreSkill([], NOW);
    expect(s).toMatchObject({ level: null, verified: false, verifiedLevel: null, selfDeclaredLevel: null, evidenceCount: 0, confidence: 0 });
    expect(s.lines).toEqual([]);
  });
  it("a measured 0 is a level of 0, not null", () => {
    expect(scoreSkill([ev({ kind: "ASSESSMENT", level: 0 })], NOW).level).toBe(0);
  });
});

describe("scoreSkill: weighting", () => {
  it("a self-declared claim is capped, unverified, low-confidence", () => {
    const s = scoreSkill([ev({ kind: "SELF_DECLARED", level: 95 })], NOW);
    expect(s).toMatchObject({ level: SELF_DECLARED_CAP, verified: false, verifiedLevel: null, selfDeclaredLevel: SELF_DECLARED_CAP });
    expect(s.confidence).toBeLessThanOrEqual(0.2);
  });
  it("a claim does not beat a verified result, and verified level ignores the claim", () => {
    const s = scoreSkill([ev({ kind: "SELF_DECLARED", level: 95 }), ev({ kind: "ASSESSMENT", level: 20 })], NOW);
    // one verified result is one proof: its depth allows 3 points, however high the claim or the score
    expect(s.verifiedLevel).toBe(3);
    expect(s.level).toBe(3);
    expect(s.verified).toBe(true);
  });
  it("older evidence counts for less (recency decay), but never vanishes", () => {
    const fresh = scoreSkill([ev({ kind: "ASSESSMENT", level: 80 }), ev({ kind: "ASSESSMENT", level: 20, observedAt: daysAgo(900) })], NOW).formula.snapshotLevel!;
    const stale = scoreSkill([ev({ kind: "ASSESSMENT", level: 80, observedAt: daysAgo(900) }), ev({ kind: "ASSESSMENT", level: 20 })], NOW).formula.snapshotLevel!;
    expect(fresh).toBeGreaterThan(stale); // the recent 80 beats the recent 20; the other way round loses
    expect(recencyFactor("ASSESSMENT", daysAgo(10_000), NOW).value).toBe(0.25);
    expect(recencyFactor("ASSESSMENT", daysAgo(HALF_LIFE_DAYS.ASSESSMENT), NOW).value).toBeCloseTo(0.5, 5);
  });
  it("harder evidence counts for more (difficulty weighting)", () => {
    const a = scoreSkill([ev({ kind: "ASSESSMENT", level: 90, difficulty: "hard" }), ev({ kind: "ASSESSMENT", level: 30, difficulty: "easy" })], NOW).formula.snapshotLevel!;
    const b = scoreSkill([ev({ kind: "ASSESSMENT", level: 90, difficulty: "easy" }), ev({ kind: "ASSESSMENT", level: 30, difficulty: "hard" })], NOW).formula.snapshotLevel!;
    expect(a).toBeGreaterThan(b);
  });
  it("undated evidence is flagged and counted at half recency", () => {
    const s = scoreSkill([ev({ kind: "ASSESSMENT", observedAt: null })], NOW);
    expect(s.lines[0]).toMatchObject({ undated: true });
    expect(s.lines[0].components.recency).toBe(0.5);
  });
});

describe("scoreSkill: Arena practice accumulates", () => {
  const pass = (days = 0, difficulty?: "easy" | "medium" | "hard") => ev({ kind: "ARENA", level: null, observedAt: daysAgo(days), difficulty });
  it("each fresh medium pass is worth 3 points: 30 reach 90, and more never go past it", () => {
    expect(ARENA_POINTS_PER_PASS).toBe(3);
    expect(scoreSkill([pass()], NOW).level).toBe(3);
    expect(scoreSkill([pass(), pass(), pass()], NOW).level).toBe(9);
    expect(scoreSkill(Array.from({ length: MASTERY_PROOFS }, () => pass()), NOW).level).toBe(MAX_WITHOUT_INTERVIEW);
    expect(scoreSkill(Array.from({ length: 60 }, () => pass()), NOW).level).toBe(MAX_WITHOUT_INTERVIEW);
  });
  it("old passes are worth less, hard ones more", () => {
    expect(scoreSkill([pass(HALF_LIFE_DAYS.ARENA)], NOW).level).toBe(2); // 3 x 0.5, rounded
    expect(scoreSkill([pass(0, "hard")], NOW).level).toBe(4); // 3 x 1.2, rounded
  });
  it("level is the higher of the snapshot and practice results, held to the depth of the proof", () => {
    const s = scoreSkill([ev({ kind: "ASSESSMENT", level: 40 }), pass(), pass(), pass()], NOW);
    expect(s.formula).toMatchObject({ snapshotLevel: 40, practiceLevel: 9 });
    expect(s.level).toBe(12); // 40 is the better result, but four proofs only show 12 points of depth
  });
});

describe("scoreSkill: confidence and the evidence list", () => {
  it("grows with more, more varied, fresher evidence and stays below 1", () => {
    const one = scoreSkill([ev({ kind: "ASSESSMENT" })], NOW).confidence;
    const three = scoreSkill([ev({ kind: "ASSESSMENT" }), ev({ kind: "PROJECT" }), ev({ kind: "ARENA", level: null })], NOW).confidence;
    expect(three).toBeGreaterThan(one);
    expect(three).toBeLessThanOrEqual(0.95);
    const stale = scoreSkill([ev({ kind: "ASSESSMENT", observedAt: daysAgo(900) })], NOW).confidence;
    expect(stale).toBeLessThan(one);
  });
  it("lists every piece of evidence with its source, date, weight and verification, newest first", () => {
    const s = scoreSkill([ev({ kind: "ASSESSMENT", label: "Initial assessment", rawScore: 62, observedAt: daysAgo(30) }), ev({ kind: "ARENA", level: null, label: "Arena: SQL ticket", observedAt: daysAgo(2), link: "/arena/attempts/1" })], NOW);
    expect(s.lines.map((l) => l.label)).toEqual(["Arena: SQL ticket", "Initial assessment"]);
    expect(s.lines[1]).toMatchObject({ rawScore: 62, verified: true, undated: false });
    expect(s.lines[0].link).toBe("/arena/attempts/1");
    expect(s.breakdown).toEqual({ ARENA: 1, ASSESSMENT: 1 });
  });
});

describe("scoreSkill: depth of proof (capability.v3)", () => {
  it("is the third version of the formula", () => {
    expect(FORMULA_VERSION).toBe("capability.v3");
  });
  it("one proof can never show a skill: a perfect score on one assessment is 3 points", () => {
    expect(scoreSkill([ev({ kind: "ASSESSMENT", level: 100 })], NOW).level).toBe(3);
    expect(proofCeiling(0)).toBe(0);
    expect(proofCeiling(1)).toBe(3);
  });
  it("many varied proofs show the high score they earned, but never past 90 without the verified interview", () => {
    const many = Array.from({ length: 40 }, () => ev({ kind: "ASSESSMENT", level: 100 }));
    expect(scoreSkill(many, NOW).level).toBe(MAX_WITHOUT_INTERVIEW);
    expect(scoreSkill(Array.from({ length: 10 }, () => ev({ kind: "ASSESSMENT", level: 100 })), NOW).level).toBe(30);
  });
  it("learning a lesson is not proof: learning-module items count for nothing", () => {
    expect(scoreSkill([ev({ kind: "LEARNING_MODULE", level: 100 })], NOW)).toMatchObject({ level: null, evidenceCount: 0, verified: false });
    expect(scoreSkill([ev({ kind: "LEARNING_MODULE", level: 100 }), ev({ kind: "ASSESSMENT", level: 100 })], NOW).evidenceCount).toBe(1);
  });
  it("leaves a self-declared claim as it was: shown, capped at 40, never deepened by the ceiling", () => {
    expect(scoreSkill([ev({ kind: "SELF_DECLARED", level: 95 })], NOW).level).toBe(SELF_DECLARED_CAP);
  });
});
