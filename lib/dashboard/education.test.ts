import { describe, expect, it } from "vitest";
import { sortEducationEntries, type EducationEntry } from "./education";

function entry(overrides: Partial<EducationEntry>): EducationEntry {
  return {
    id: "id",
    institutionName: "Institution",
    city: null,
    state: null,
    degree: null,
    fieldOfStudy: null,
    startYear: null,
    endYear: null,
    branch: null,
    year: null,
    memberSince: "2026-01-01T00:00:00Z",
    hasVerifiedCertificate: false,
    ...overrides,
  };
}

describe("sortEducationEntries", () => {
  it("ranks an ongoing entry above a finished one that ends the same year it started", () => {
    // Exact reported bug: B.Tech (2026-Present) was sorting BELOW
    // Intermediate (2024-2026) because both entries resolved to the same
    // sort year (2026) when "ongoing" fell back to startYear instead of
    // being treated as more recent than any finished entry.
    const btech = entry({ id: "btech", institutionName: "B.Tech college", startYear: 2026, endYear: null });
    const intermediate = entry({
      id: "intermediate",
      institutionName: "Intermediate college",
      startYear: 2024,
      endYear: 2026,
    });
    const ssc = entry({ id: "ssc", institutionName: "SSC school", startYear: 2023, endYear: 2024 });

    const sorted = sortEducationEntries([intermediate, btech, ssc]);

    expect(sorted.map((e) => e.id)).toEqual(["btech", "intermediate", "ssc"]);
  });

  it("orders purely finished entries by end year, most recent first", () => {
    const a = entry({ id: "a", startYear: 2010, endYear: 2014 });
    const b = entry({ id: "b", startYear: 2014, endYear: 2018 });
    expect(sortEducationEntries([a, b]).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("falls back to when the entry was added when neither year is known", () => {
    const older = entry({ id: "older", memberSince: "2026-01-01T00:00:00Z" });
    const newer = entry({ id: "newer", memberSince: "2026-06-01T00:00:00Z" });
    expect(sortEducationEntries([older, newer]).map((e) => e.id)).toEqual(["newer", "older"]);
  });
});
