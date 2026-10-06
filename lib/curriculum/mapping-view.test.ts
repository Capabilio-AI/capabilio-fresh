import { describe, expect, it } from "vitest";
import type { MappingView, SkillOption } from "./admin-data";
import { groupCatalog, mappingChips, reviewState, statusCounts } from "./mapping-view";

const skill = (name: string, category: string, key = `SKILL_${name.toUpperCase().replace(/\W+/g, "_")}`, description: string | null = null): SkillOption => ({ id: key, key, name, category, description });
const CATALOG = [skill("SQL", "Data"), skill("Statistics", "Data"), skill("Python", "Programming"), skill("Graph Algorithms", "Programming", undefined, "BFS, DFS, shortest paths"), skill("Cryptography", "Cybersecurity")];
const mapping = (skillName: string, status: MappingView["status"], over: Partial<MappingView> = {}): MappingView => ({
  id: skillName, skillId: skillName, skillName, category: "Data", source: status === "CONFIRMED" ? "COLLEGE_CONFIRMED" : "AI_SUGGESTED", status, confidence: 0.8, importance: null, evidence: null, approvedAt: null, ...over,
});

describe("groupCatalog", () => {
  it("groups by category, categories and skills alphabetical", () => {
    expect(groupCatalog(CATALOG, "").map((g) => [g.category, g.skills.map((s) => s.name)])).toEqual([
      ["Cybersecurity", ["Cryptography"]], ["Data", ["SQL", "Statistics"]], ["Programming", ["Graph Algorithms", "Python"]],
    ]);
  });
  it("searches name, description and category, case-insensitively, ignoring punctuation", () => {
    expect(groupCatalog(CATALOG, "sql").flatMap((g) => g.skills.map((s) => s.name))).toEqual(["SQL"]);
    expect(groupCatalog(CATALOG, "shortest PATHS").flatMap((g) => g.skills.map((s) => s.name))).toEqual(["Graph Algorithms"]);
    expect(groupCatalog(CATALOG, "cyber").flatMap((g) => g.skills.map((s) => s.name))).toEqual(["Cryptography"]);
    expect(groupCatalog(CATALOG, "  ").length).toBe(3);
  });
  it("returns nothing for a query that matches nothing (the UI says so)", () => {
    expect(groupCatalog(CATALOG, "quantum")).toEqual([]);
  });
  it("can hide skills that are already chosen", () => {
    expect(groupCatalog(CATALOG, "", new Set(["SKILL_SQL"])).flatMap((g) => g.skills.map((s) => s.name))).not.toContain("SQL");
  });
});

describe("mapping chips and counts (regression: 'Mapped to 2' with nothing shown)", () => {
  const rows = [mapping("SQL", "CONFIRMED"), mapping("Statistics", "SUGGESTED", { confidence: 0.9 }), mapping("Python", "SUGGESTED", { confidence: 0.5 }), mapping("Cryptography", "REJECTED")];
  it("every counted mapping is a chip that is shown, in a stable order: confirmed, suggested (best first), rejected", () => {
    const chips = mappingChips(rows);
    expect(chips.map((c) => c.skillName)).toEqual(["SQL", "Statistics", "Python", "Cryptography"]);
    const counts = statusCounts(rows);
    expect(counts).toEqual({ confirmed: 1, suggested: 2, rejected: 1, total: 4 });
    expect(chips.length).toBe(counts.total);
  });
  it("the label count can never exceed the chips on screen, whatever the data", () => {
    for (const set of [[], [mapping("SQL", "CONFIRMED")], rows, [mapping("A", "REJECTED"), mapping("B", "REJECTED")]]) {
      expect(statusCounts(set).total).toBe(mappingChips(set).length);
    }
  });
  it("is a pure function of the stored rows: hydrating the same rows twice gives the same chips", () => {
    expect(mappingChips(rows)).toEqual(mappingChips([...rows].reverse()));
  });
});

describe("reviewState", () => {
  it("none / needs_review / reviewed", () => {
    expect(reviewState([])).toBe("none");
    expect(reviewState([mapping("SQL", "SUGGESTED")])).toBe("needs_review");
    expect(reviewState([mapping("SQL", "CONFIRMED"), mapping("Python", "SUGGESTED")])).toBe("needs_review");
    expect(reviewState([mapping("SQL", "CONFIRMED"), mapping("Python", "REJECTED")])).toBe("reviewed");
  });
});
