import { describe, expect, it } from "vitest";
import { arenaConfidence, arenaLevel, ARENA_LEVEL_PER_VERIFIED, combineEvidence, kindOfSource, SELF_DECLARED_MAX_LEVEL, type EvidenceItem } from "./read-model";

const item = (skillId: string, kind: EvidenceItem["kind"], level: number, confidence = 0.7): EvidenceItem => ({ skillId, kind, level, confidence });

describe("arenaLevel (the documented count -> level formula)", () => {
  it("is 25 per verified task, capped at 100", () => {
    expect(ARENA_LEVEL_PER_VERIFIED).toBe(25);
    expect([0, 1, 2, 3, 4, 5, 40].map(arenaLevel)).toEqual([0, 25, 50, 75, 100, 100, 100]);
  });
  it("confidence grows with verified tasks and is 0 with none", () => {
    expect([0, 1, 2, 3, 9].map(arenaConfidence)).toEqual([0, 0.5, 0.7, 0.9, 0.9]);
  });
});

describe("kindOfSource", () => {
  it("maps capability sources to evidence kinds", () => {
    expect(kindOfSource("initial_assessment")).toBe("ASSESSMENT");
    expect(kindOfSource("reassessment")).toBe("ASSESSMENT");
    expect(kindOfSource("arena_challenge")).toBe("ARENA");
    expect(kindOfSource("project")).toBe("PROJECT");
    expect(kindOfSource("github_repository")).toBe("GITHUB");
    expect(kindOfSource("learning_module")).toBe("LEARNING_MODULE");
    expect(kindOfSource(undefined)).toBe("ASSESSMENT");
  });
});

describe("combineEvidence", () => {
  it("verified evidence sets the level: the strongest demonstrated level wins", () => {
    const c = combineEvidence([item("sql", "ASSESSMENT", 60), item("sql", "ARENA", 75, 0.9)]).get("sql")!;
    expect(c).toMatchObject({ level: 75, verified: true, verifiedLevel: 75, selfDeclaredLevel: null });
    expect(c.confidence).toBe(0.9);
    expect(c.breakdown).toEqual({ ASSESSMENT: 1, ARENA: 1 });
  });
  it("self-declared evidence is capped, unverified, and never outweighs verified evidence", () => {
    const only = combineEvidence([item("py", "SELF_DECLARED", 95, 0.9)]).get("py")!;
    expect(only).toMatchObject({ level: SELF_DECLARED_MAX_LEVEL, verified: false, verifiedLevel: null, selfDeclaredLevel: SELF_DECLARED_MAX_LEVEL });
    const both = combineEvidence([item("py", "SELF_DECLARED", 95), item("py", "ASSESSMENT", 20, 0.4)]).get("py")!;
    expect(both).toMatchObject({ level: 20, verified: true, verifiedLevel: 20, selfDeclaredLevel: SELF_DECLARED_MAX_LEVEL }); // a claim of 95 does not beat a verified 20
    expect(both.confidence).toBe(0.4); // confidence comes from the verified evidence only
  });
  it("clamps nonsense levels and keeps skills separate", () => {
    const m = combineEvidence([item("a", "ASSESSMENT", 140), item("b", "ASSESSMENT", -5)]);
    expect(m.get("a")!.level).toBe(100);
    expect(m.get("b")!.level).toBe(0);
    expect(m.size).toBe(2);
  });
  it("gives nothing for no evidence (the caller says 'no capability data' instead of inventing a level)", () => {
    expect(combineEvidence([]).size).toBe(0);
  });
  it("is order-independent", () => {
    const a = [item("x", "ARENA", 50, 0.5), item("x", "PROJECT", 80, 0.9), item("x", "SELF_DECLARED", 30)];
    expect(combineEvidence([...a].reverse()).get("x")).toEqual(combineEvidence(a).get("x"));
  });
});
