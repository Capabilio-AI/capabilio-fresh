import { describe, expect, it } from "vitest";
import { buildSkillIndex } from "@/lib/skills/resolve";
import { applyFallback, resolveCandidates } from "./enrich";
import { parseCourseSection, type ParsedSection } from "./section";
import { isGrounded, wordOverlap } from "./ground";

const TEXT = `Course Objectives
To study graph traversal and shortest paths in networks
Course Outcomes
CO1: Implement breadth first and depth first search on graphs
CO2: Analyse the running time of shortest path algorithms
Unit 1 Graph algorithms: BFS, DFS, Dijkstra
Text Books
1. Introduction to Algorithms, Cormen, MIT Press`;
const empty = (): ParsedSection => parseCourseSection([]);

describe("grounding", () => {
  it("measures how much of a claim is in the source", () => {
    expect(wordOverlap("graph traversal and shortest paths", TEXT)).toBe(1);
    expect(wordOverlap("quantum teleportation of qubits", TEXT)).toBeLessThan(0.5); // only "of" is shared
    expect(isGrounded("Dijkstra", TEXT)).toBe(true);
  });
});

describe("applyFallback (AI-structured section)", () => {
  const ai = {
    objectives: ["To study graph traversal and shortest paths in networks", "To master quantum teleportation of qubits"],
    outcomes: [{ code: "CO1", text: "Implement breadth first and depth first search on graphs" }, { code: "CO2", text: "Invent a perpetual motion machine" }],
    units: [{ unitNo: 1, title: "Graph algorithms", topics: ["BFS", "DFS", "Dijkstra", "Ant colony optimisation"] }],
    experiments: [],
    textbooks: ["Introduction to Algorithms, Cormen, MIT Press"],
    referenceBooks: [],
  };
  it("keeps only what is found in the source text and counts what it dropped", () => {
    const r = applyFallback(empty(), ai, TEXT);
    expect(r.parsed.objectives).toEqual(["To study graph traversal and shortest paths in networks"]);
    expect(r.parsed.outcomes.map((o) => o.code)).toEqual(["CO1"]);
    expect(r.parsed.units[0].topics).toEqual(["BFS", "DFS", "Dijkstra"]);
    expect(r.parsed.textbooks).toHaveLength(1);
    expect(r.dropped).toBe(3); // one objective, one outcome, one topic
    expect(r.parsed.complete).toBe(true);
    expect(r.parsed.provenance.outcomes).toMatch(/AI structurer/);
  });
  it("never overwrites a field the deterministic parser already read", () => {
    const parsed = { ...empty(), objectives: ["Read by the parser"] };
    expect(applyFallback(parsed, ai, TEXT).parsed.objectives).toEqual(["Read by the parser"]);
  });
  it("outcomes from the AI carry no Bloom level (it is only taken from an explicit K-tag)", () => {
    expect(applyFallback(empty(), ai, TEXT).parsed.outcomes[0].bloom).toBeNull();
  });
});

describe("resolveCandidates (skills the AI proposed)", () => {
  const index = buildSkillIndex(
    [{ id: "ga", name: "Graph Algorithms", status: "active" }, { id: "alg", name: "Algorithms", status: "active" }, { id: "cand", name: "Quantum Computing", status: "candidate" }],
    [{ skillId: "ga", alias: "bfs dfs" }]
  );
  const ctx = { sectionText: TEXT, outcomeCodes: new Set(["CO1", "CO2"]) };
  it("resolves names to canonical ids with the outcomes that support them", () => {
    const r = resolveCandidates([{ name: "Graph Algorithms", evidence: "CO1: Implement breadth first and depth first search on graphs", outcomes: ["CO1", "CO9"], confidence: "high" }], index, ctx);
    expect(r.mappings).toEqual([{ skillId: "ga", confidence: 0.9, evidence: "CO1: Implement breadth first and depth first search on graphs", outcomeCodes: ["CO1"] }]);
  });
  it("queues skills it cannot resolve, and never resolves to an unreviewed candidate skill", () => {
    const r = resolveCandidates([
      { name: "Quantum Computing", evidence: "To study graph traversal and shortest paths in networks", outcomes: [], confidence: "high" },
      { name: "Ant Colony Optimisation", evidence: "Unit 1 Graph algorithms: BFS, DFS, Dijkstra", outcomes: [], confidence: "medium" },
    ], index, ctx);
    expect(r.mappings).toEqual([]);
    expect(r.unresolved.map((u) => u.name)).toEqual(["Quantum Computing", "Ant Colony Optimisation"]);
  });
  it("drops a candidate whose evidence is not in the course text", () => {
    const r = resolveCandidates([{ name: "Algorithms", evidence: "Students will build rocket engines in orbit", outcomes: [], confidence: "high" }], index, ctx);
    expect(r.mappings).toEqual([]);
    expect(r.dropped).toBe(1);
  });
  it("merges duplicates: highest confidence wins and outcomes are unioned", () => {
    const e = "To study graph traversal and shortest paths in networks";
    const r = resolveCandidates([
      { name: "Graph Algorithms", evidence: e, outcomes: ["CO1"], confidence: "low" },
      { name: "bfs dfs", evidence: e, outcomes: ["CO2"], confidence: "high" },
    ], index, ctx);
    expect(r.mappings).toHaveLength(1);
    expect(r.mappings[0]).toMatchObject({ skillId: "ga", confidence: 0.9, outcomeCodes: ["CO1", "CO2"] });
  });
});
