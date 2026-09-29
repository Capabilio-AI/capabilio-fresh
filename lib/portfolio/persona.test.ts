import { describe, expect, it } from "vitest";
import { derivePersona } from "./persona";
import { buildCapabilityGroups, type PortfolioEvidence } from "./view";

const row = (over: Partial<PortfolioEvidence>): PortfolioEvidence => ({
  skill: "SQL",
  sourceType: "arena_challenge",
  evidenceType: "arena_result",
  sourceUrl: "/arena/attempts/a1",
  observedAt: "2026-09-20T10:00:00Z",
  confidence: "medium",
  createdAt: "2026-09-20T10:00:00Z",
  metadata: { parentSkill: "Data Analysis" },
  ...over,
});

describe("derivePersona", () => {
  it("returns null when nothing has been demonstrated", () => {
    expect(derivePersona([])).toBeNull();
  });

  it("uses the curated label for a known group", () => {
    const groups = buildCapabilityGroups([row({})]);
    expect(derivePersona(groups)).toEqual({ title: "The Insight Engine", description: "Data storytelling, business impact, analytical rigor" });
  });

  it("falls back to a generic label for an unrecognized group", () => {
    const groups = buildCapabilityGroups([row({ metadata: { parentSkill: "Cloud Infrastructure" } })]);
    expect(derivePersona(groups)).toEqual({ title: "The Cloud Infrastructure Specialist", description: "Demonstrated through verified cloud infrastructure work" });
  });
});
