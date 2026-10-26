import { describe, expect, it } from "vitest";
import { summariseArenaWork } from "./arena-work";

const roles = [
  { role_key: "data-analyst", display_name: "Data Analyst" },
  { role_key: "soc-analyst", display_name: "SOC Analyst" },
];
const areas = [
  { role_key: "data-analyst", area_key: "sql", display_name: "SQL querying" },
  { role_key: "data-analyst", area_key: "stats", display_name: "Statistics" },
  { role_key: "soc-analyst", area_key: "triage", display_name: "Alert triage" },
];

describe("summariseArenaWork", () => {
  it("groups verified areas by role with exact counts and the latest pass date", () => {
    const out = summariseArenaWork(
      [
        { role_key: "data-analyst", area_key: "sql", verified_count: 3, last_verified_at: "2026-10-01T00:00:00Z" },
        { role_key: "data-analyst", area_key: "stats", verified_count: 1, last_verified_at: "2026-10-20T00:00:00Z" },
        { role_key: "soc-analyst", area_key: "triage", verified_count: 1, last_verified_at: "2026-09-01T00:00:00Z" },
      ],
      roles,
      areas
    );
    expect(out.map((r) => [r.roleName, r.verifiedCount, r.lastPassedAt])).toEqual([
      ["Data Analyst", 4, "2026-10-20T00:00:00Z"],
      ["SOC Analyst", 1, "2026-09-01T00:00:00Z"],
    ]);
    expect(out[0].areas.map((a) => [a.areaName, a.verifiedCount])).toEqual([
      ["SQL querying", 3],
      ["Statistics", 1],
    ]);
  });

  it("drops ratings with no verified attempt (a seeded rating is not work)", () => {
    expect(summariseArenaWork([{ role_key: "data-analyst", area_key: "sql", verified_count: 0, last_verified_at: null }], roles, areas)).toEqual([]);
  });

  it("falls back to keys when names are missing", () => {
    const [r] = summariseArenaWork([{ role_key: "x-role", area_key: "y-area", verified_count: 2, last_verified_at: null }], [], []);
    expect([r.roleName, r.areas[0].areaName, r.lastPassedAt]).toEqual(["x-role", "y-area", null]);
  });
});
