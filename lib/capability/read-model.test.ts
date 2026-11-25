import { describe, expect, it } from "vitest";
import { arenaConfidence, arenaLevel, ARENA_LEVEL_PER_VERIFIED, combineEvidence, kindOfSource, SELF_DECLARED_MAX_LEVEL } from "./read-model";
import type { EvidenceInput } from "@/lib/roadmap-visual/capability";

const NOW = new Date("2026-10-07T00:00:00Z");
const item = (skillId: string, kind: EvidenceInput["kind"], level: number | null): EvidenceInput & { skillId: string } => ({ skillId, kind, level, observedAt: NOW, label: "x" });

describe("arenaLevel (the legacy count -> level helper, kept for existing readers)", () => {
  it("is 3 per verified task, capped at 90", () => {
    expect(ARENA_LEVEL_PER_VERIFIED).toBe(3);
    expect([0, 1, 2, 3, 30, 40].map(arenaLevel)).toEqual([0, 3, 6, 9, 90, 90]);
  });
  it("confidence grows with verified tasks and is 0 with none", () => {
    expect([0, 1, 2, 3, 9].map(arenaConfidence)).toEqual([0, 0.5, 0.7, 0.9, 0.9]);
  });
});

describe("kindOfSource", () => {
  it("maps capability sources to evidence kinds", () => {
    expect(kindOfSource("initial_assessment")).toBe("ASSESSMENT");
    expect(kindOfSource("arena_challenge")).toBe("ARENA");
    expect(kindOfSource("project")).toBe("PROJECT");
    expect(kindOfSource("github_repository")).toBe("GITHUB");
    expect(kindOfSource("learning_module")).toBe("LEARNING_MODULE");
    expect(kindOfSource(undefined)).toBe("ASSESSMENT");
    expect(kindOfSource(null)).toBe("ASSESSMENT");
  });
});

describe("combineEvidence (capability.v3)", () => {
  it("scores each skill from its own evidence, with the evidence list attached", () => {
    const m = combineEvidence([item("sql", "ASSESSMENT", 60), item("sql", "ARENA", null), item("py", "ASSESSMENT", 40)], NOW);
    // two proofs show 6 points of depth however well they went; one proof shows 3
    expect(m.get("sql")).toMatchObject({ level: 6, verified: true, evidenceCount: 2, breakdown: { ASSESSMENT: 1, ARENA: 1 } });
    expect(m.get("sql")!.lines).toHaveLength(2);
    expect(m.get("py")!.level).toBe(3);
    expect(m.size).toBe(2);
  });
  it("a self-declared skill is capped, unverified and never outweighs verified evidence", () => {
    const only = combineEvidence([item("py", "SELF_DECLARED", 95)], NOW).get("py")!;
    expect(only).toMatchObject({ level: SELF_DECLARED_MAX_LEVEL, verified: false, verifiedLevel: null });
    const both = combineEvidence([item("py", "SELF_DECLARED", 95), item("py", "ASSESSMENT", 20)], NOW).get("py")!;
    expect(both.verifiedLevel).toBe(3);
    expect(both.level!).toBeLessThanOrEqual(3);
  });
  it("a skill with no evidence is absent, never present with a level of 0", () => {
    expect(combineEvidence([], NOW).size).toBe(0);
  });
  it("a measured 0 stays a 0 (and is distinguishable from no evidence)", () => {
    expect(combineEvidence([item("a", "ASSESSMENT", 0)], NOW).get("a")!.level).toBe(0);
  });
});
