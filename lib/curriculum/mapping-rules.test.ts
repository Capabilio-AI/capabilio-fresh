import { describe, expect, it } from "vitest";
import { canTransitionImport, confirmMapping, isOfficial, officialOnly, proposeAiMapping, rejectMapping, type MappingRow } from "./mapping-rules";

const NOW = "2026-10-06T00:00:00.000Z";
const row = (over: Partial<MappingRow> = {}): MappingRow => ({
  skillId: "s1", status: "SUGGESTED", source: "AI_SUGGESTED", confidence: 0.8, importance: null, evidence: "CO1 text",
  approvedBy: null, approvedAt: null, ...over,
});

describe("proposeAiMapping", () => {
  it("inserts a new suggestion as SUGGESTED/AI_SUGGESTED, never confirmed", () => {
    const r = proposeAiMapping(null, { skillId: "s1", confidence: 0.7, evidence: "e" });
    expect(r).toMatchObject({ action: "insert", row: { status: "SUGGESTED", source: "AI_SUGGESTED", approvedAt: null, approvedBy: null } });
  });
  it("refreshes an existing unreviewed suggestion", () => {
    expect(proposeAiMapping(row(), { skillId: "s1", confidence: 0.9, evidence: "new" })).toMatchObject({ action: "update", row: { confidence: 0.9, status: "SUGGESTED" } });
  });
  it("never touches a CONFIRMED mapping", () => {
    expect(proposeAiMapping(row({ status: "CONFIRMED", source: "COLLEGE_CONFIRMED", approvedAt: NOW }), { skillId: "s1", confidence: 0.1, evidence: "x" }).action).toBe("skip");
  });
  it("never re-suggests a REJECTED mapping", () => {
    expect(proposeAiMapping(row({ status: "REJECTED" }), { skillId: "s1", confidence: 0.99, evidence: "x" }).action).toBe("skip");
  });
});

describe("confirmMapping / rejectMapping", () => {
  it("a college confirming a suggestion makes it COLLEGE_CONFIRMED with who and when", () => {
    const r = confirmMapping(row(), { userId: "u1", now: NOW });
    expect(r).toMatchObject({ status: "CONFIRMED", source: "COLLEGE_CONFIRMED", approvedBy: "u1", approvedAt: NOW });
  });
  it("a skill the college adds itself is MANUAL", () => {
    expect(confirmMapping(null, { userId: "u1", now: NOW, skillId: "s2" })).toMatchObject({ skillId: "s2", status: "CONFIRMED", source: "MANUAL", approvedBy: "u1" });
  });
  it("re-adding a rejected skill is an explicit MANUAL decision", () => {
    expect(confirmMapping(row({ status: "REJECTED" }), { userId: "u1", now: NOW })).toMatchObject({ status: "CONFIRMED", source: "MANUAL" });
  });
  it("confirming twice is idempotent and keeps the original approver", () => {
    const once = confirmMapping(row(), { userId: "u1", now: NOW });
    expect(confirmMapping(once, { userId: "u2", now: "2027-01-01T00:00:00.000Z" })).toEqual(once);
  });
  it("rejecting stores REJECTED and clears any approval", () => {
    const confirmed = confirmMapping(row(), { userId: "u1", now: NOW });
    expect(rejectMapping(confirmed, { userId: "u2", now: NOW })).toMatchObject({ status: "REJECTED", approvedAt: null });
  });
});

describe("official = confirmed by a person", () => {
  it("only CONFIRMED non-AI rows drive roadmaps", () => {
    const rows = [
      row(),
      row({ skillId: "a", status: "CONFIRMED", source: "COLLEGE_CONFIRMED", approvedAt: NOW }),
      row({ skillId: "b", status: "CONFIRMED", source: "MANUAL", approvedAt: NOW }),
      row({ skillId: "c", status: "REJECTED" }),
      row({ skillId: "d", status: "CONFIRMED", source: "AI_SUGGESTED", approvedAt: NOW }), // impossible in the DB; still never official
    ];
    expect(officialOnly(rows).map((r) => r.skillId)).toEqual(["a", "b"]);
    expect(isOfficial(rows[0])).toBe(false);
  });
});

describe("canTransitionImport", () => {
  it.each([
    ["DRAFT", "EXTRACTED"], ["EXTRACTED", "UNDER_REVIEW"], ["UNDER_REVIEW", "CONFIRMED"], ["CONFIRMED", "PUBLISHED"], ["PUBLISHED", "ARCHIVED"],
    ["CONFIRMED", "UNDER_REVIEW"], ["UNDER_REVIEW", "EXTRACTED"],
  ] as const)("%s -> %s is allowed", (a, b) => expect(canTransitionImport(a, b)).toBe(true));
  it.each([
    ["DRAFT", "PUBLISHED"], ["EXTRACTED", "PUBLISHED"], ["UNDER_REVIEW", "PUBLISHED"], ["PUBLISHED", "CONFIRMED"], ["PUBLISHED", "DRAFT"], ["ARCHIVED", "PUBLISHED"], ["ARCHIVED", "DRAFT"],
  ] as const)("%s -> %s is refused", (a, b) => expect(canTransitionImport(a, b)).toBe(false));
});
