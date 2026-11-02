import { describe, expect, it } from "vitest";
import { canonicalJson, fingerprintOf, isIntact, MAX_SUBMISSION_CHARS, sealEvidence, type SealInput } from "./seal";

const input: SealInput = {
  attemptId: "a1", userId: "u1", roleKey: "data-analyst", areaKey: "sql", areaName: "SQL", company: "BrightCart", skillIds: ["s1", "s2"], difficulty: "medium", toolType: "sql_workspace",
  title: "Revenue by city", requester: "Rohan · Sales", scenario: "Hi...", objective: "Return one row per city", submission: { query: "SELECT city, SUM(x) FROM t GROUP BY city" },
  grade: { passed: true, message: "ok", checks: [{ label: "Result matches", passed: true }] }, submissions: 2, gradingVersion: "sql.grade.v1", generationVersion: "sql.gen.v1",
  assignedAt: "2026-11-01T10:00:00Z", completedAt: "2026-11-01T10:40:00Z", explained: true, explanationScore: 82,
};

describe("sealing evidence", () => {
  it("fingerprints the same content the same way whatever the key order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
    const a = sealEvidence(input);
    const b = sealEvidence({ ...input, submission: { query: "SELECT city, SUM(x) FROM t GROUP BY city" }, grade: { checks: [{ passed: true, label: "Result matches" }], message: "ok", passed: true } });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the fingerprint when any sealed field changes, even by one character", () => {
    const base = sealEvidence(input).fingerprint;
    for (const change of [{ submission: { query: "SELECT city, SUM(x) FROM t GROUP BY city;" } }, { difficulty: "hard" }, { explanationScore: 83 }, { submissions: 3 }, { title: "Revenue by cities" }, { completedAt: "2026-11-01T10:41:00Z" }]) {
      expect(sealEvidence({ ...input, ...change }).fingerprint, JSON.stringify(change)).not.toBe(base);
    }
  });

  it("ties a record to its owner and attempt", () => {
    const { content } = sealEvidence(input);
    expect(fingerprintOf("a1", "u1", content)).not.toBe(fingerprintOf("a2", "u1", content));
    expect(fingerprintOf("a1", "u1", content)).not.toBe(fingerprintOf("a1", "u2", content));
  });

  it("detects a record that was altered after sealing, and passes one that was not", () => {
    const { content, fingerprint } = sealEvidence(input);
    expect(isIntact("a1", "u1", content, fingerprint)).toBe(true);
    expect(isIntact("a1", "u1", { ...content, grade: { ...content.grade, passed: false } }, fingerprint)).toBe(false);
    expect(isIntact("a1", "u1", { ...content, submission: { query: "SELECT 1" } }, fingerprint)).toBe(false);
  });

  it("replaces an oversize submission with a plain note, and fingerprints what is actually stored", () => {
    const big = sealEvidence({ ...input, submission: { cells: "x".repeat(MAX_SUBMISSION_CHARS + 10) } });
    expect(big.truncated).toBe(true);
    expect(JSON.stringify(big.content.submission)).toContain("too large");
    expect(isIntact("a1", "u1", big.content, big.fingerprint)).toBe(true);
    expect(sealEvidence(input).truncated).toBe(false);
  });

  it("keeps null and missing submissions distinct from an empty object, and never throws on them", () => {
    expect(sealEvidence({ ...input, submission: null }).content.submission).toBeNull();
    expect(sealEvidence({ ...input, submission: undefined }).content.submission).toBeNull();
  });
});
