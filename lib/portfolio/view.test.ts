import { describe, expect, it } from "vitest";
import { buildCapabilityGroups, evidenceLine, toRadarData, type PortfolioEvidence } from "./view";

const row = (over: Partial<PortfolioEvidence>): PortfolioEvidence => ({
  skill: "SQL",
  sourceType: "arena_challenge",
  evidenceType: "arena_result",
  sourceUrl: "/arena/attempts/a1",
  observedAt: "2026-09-20T10:00:00Z",
  confidence: "medium",
  createdAt: "2026-09-20T10:00:00Z",
  metadata: { parentSkill: "Data Analysis", title: "August sales", company: "Kiranakart" },
  ...over,
});

describe("portfolio capability groups", () => {
  it("groups Arena sub-skills under their parent capability", () => {
    const groups = buildCapabilityGroups([row({}), row({ skill: "Statistics", sourceUrl: "/arena/attempts/a2" }), row({ sourceUrl: "/arena/attempts/a3" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Data Analysis");
    expect(groups[0].capabilities.map((c) => c.skill)).toEqual(["SQL", "Statistics"]);
    expect(groups[0].capabilities[0].arenaCount).toBe(2);
  });

  it("merges GitHub and Arena evidence for the same skill and keeps GitHub-only skills separate", () => {
    const groups = buildCapabilityGroups([
      row({}),
      row({ sourceType: "github_repository", evidenceType: "technology_usage", sourceUrl: "https://github.com/x/y", metadata: null }),
      row({ skill: "React", sourceType: "github_repository", evidenceType: "technology_usage", sourceUrl: "https://github.com/x/z", metadata: null }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Data Analysis", "Observed in code"]);
    const sql = groups[0].capabilities[0];
    expect(evidenceLine(sql)).toBe("1 verified Arena task · GitHub activity (1 repo)");
    expect(groups[1].capabilities[0].skill).toBe("React");
  });

  it("shows nothing when there is no evidence (no fabricated sections)", () => {
    expect(buildCapabilityGroups([])).toEqual([]);
  });

  it("orders evidence most recent first", () => {
    const groups = buildCapabilityGroups([row({ observedAt: "2026-09-01T00:00:00Z", sourceUrl: "/old" }), row({ observedAt: "2026-09-25T00:00:00Z", sourceUrl: "/new" })]);
    expect(groups[0].capabilities[0].evidence[0].sourceUrl).toBe("/new");
  });
});

describe("toRadarData", () => {
  it("caps evidence density at 100 rather than showing a self-assessed level", () => {
    const groups = buildCapabilityGroups([
      row({ sourceUrl: "/a1" }),
      row({ sourceUrl: "/a2" }),
      row({ sourceUrl: "/a3" }),
      row({ sourceUrl: "/a4" }),
      row({ sourceUrl: "/a5" }),
    ]);
    const [point] = toRadarData(groups[0].capabilities);
    expect(point).toEqual({ subject: "SQL", value: 100 });
  });

  it("returns nothing when there is no evidence", () => {
    expect(toRadarData([])).toEqual([]);
  });
});
