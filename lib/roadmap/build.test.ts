import { describe, expect, it } from "vitest";
import { buildRoadmap, type RoadmapInput } from "./build";

const AREAS = [
  { key: "sql", name: "SQL", enabled: true },
  { key: "python", name: "Python", enabled: false },
  { key: "spreadsheet", name: "Excel / Spreadsheets", enabled: true },
  { key: "statistics", name: "Statistics", enabled: true },
  { key: "dashboard", name: "BI / Dashboarding", enabled: true },
];
const TARGETS = ["sql", "spreadsheet", "statistics", "dashboard"].map((areaKey) => ({ areaKey, minVerified: 3 }));
const RESOURCES = [{ areaKey: "dashboard", kind: "certification" as const, title: "PL-300", url: "https://example.com/pl300", description: null }, { areaKey: "sql", kind: "practice" as const, title: "should never appear on an affirmed area", url: null, description: null }];

const base = (over: Partial<RoadmapInput> = {}): RoadmapInput => ({
  role: { key: "data-analyst", name: "Data Analyst" },
  areas: AREAS,
  targets: TARGETS,
  verified: {},
  academicYear: 3,
  subjects: [
    { id: "1", name: "DBMS", year: 3, areaKeys: ["sql"] },
    { id: "2", name: "Probability & Statistics", year: 2, areaKeys: ["statistics"] },
    { id: "3", name: "Data Visualisation", year: 4, areaKeys: ["dashboard"] },
    { id: "4", name: "Compilers", year: 3, areaKeys: [] },
    { id: "5", name: "Year 6 elective", year: 6, areaKeys: ["spreadsheet"] },
  ],
  resources: RESOURCES,
  ...over,
});

function ready(input: RoadmapInput) {
  const r = buildRoadmap(input);
  if (r.status !== "ready") throw new Error("expected ready, got " + r.reasons.join());
  return r;
}
const keys = (items: { areaKey: string }[]) => items.map((i) => i.areaKey);

describe("three-bucket gap analysis", () => {
  it("covered+demonstrated → affirm; covered+not → engage; uncovered+not → external", () => {
    const r = ready(base({ verified: { sql: 3, statistics: 1 } }));
    expect(keys(r.affirm)).toEqual(["sql"]);
    expect(keys(r.engage)).toEqual(["statistics", "dashboard"]); // dashboard is covered next year
    expect(keys(r.external)).toEqual(["spreadsheet"]); // its only subject is beyond next year
  });

  it("tags coverage timing and ignores subjects more than one year ahead", () => {
    const r = ready(base());
    const stats = r.engage.find((i) => i.areaKey === "statistics")!;
    expect(stats.covering).toEqual([{ name: "Probability & Statistics", year: 2, timing: "past" }]);
    expect(r.engage.find((i) => i.areaKey === "dashboard")!.covering[0].timing).toBe("next_year");
    expect(r.external.find((i) => i.areaKey === "spreadsheet")!.covering).toEqual([]);
  });

  it("demonstrated-but-uncovered is affirmed as beyond the curriculum", () => {
    const r = ready(base({ verified: { spreadsheet: 5 } }));
    expect(r.affirm.find((i) => i.areaKey === "spreadsheet")!.beyondCurriculum).toBe(true);
  });

  it("arena focus is deterministic: tasks remaining = min − verified, never negative", () => {
    const r = ready(base({ verified: { sql: 9, statistics: 2 } }));
    expect(r.affirm[0].arenaTasksRemaining).toBe(0);
    expect(r.engage.find((i) => i.areaKey === "statistics")!.arenaTasksRemaining).toBe(1);
  });

  it("curated resources appear only on external gaps and only the stored ones", () => {
    const r = ready(base({ subjects: [{ id: "1", name: "DBMS", year: 3, areaKeys: ["sql"] }] }));
    const dash = r.external.find((i) => i.areaKey === "dashboard")!;
    expect(dash.resources.map((x) => x.title)).toEqual(["PL-300"]);
    expect([...r.affirm, ...r.engage].every((i) => i.resources.length === 0)).toBe(true);
    expect(r.external.find((i) => i.areaKey === "spreadsheet")!.resources).toEqual([]); // none stored → none invented
  });

  it("a student with zero verified evidence still gets a full, honest roadmap", () => {
    const r = ready(base({ verified: {} }));
    expect(r.affirm).toHaveLength(0);
    expect(r.engage.length + r.external.length).toBe(4);
  });

  it("disabled areas (Python) are never a gap, even if a subject maps to them", () => {
    const r = ready(base({ subjects: [{ id: "1", name: "Python 101", year: 3, areaKeys: ["python", "sql"] }] }));
    const all = [...r.affirm, ...r.engage, ...r.external].map((i) => i.areaKey);
    expect(all).not.toContain("python");
  });
});

describe("honest needs_info states — never an empty-looking roadmap", () => {
  const reasons = (i: RoadmapInput) => {
    const r = buildRoadmap(i);
    return r.status === "needs_info" ? r.reasons : ["READY"];
  };
  it("no role", () => expect(reasons(base({ role: null }))).toEqual(["no_role"]));
  it("no target profile", () => expect(reasons(base({ targets: [] }))).toContain("no_target_profile"));
  it("no curriculum uploaded", () => expect(reasons(base({ subjects: [] }))).toEqual(["no_curriculum"]));
  it("year unknown / unconfirmed", () => expect(reasons(base({ academicYear: null }))).toContain("year_unknown"));
  it("only past years uploaded", () =>
    expect(reasons(base({ subjects: [{ id: "1", name: "Old", year: 1, areaKeys: ["sql"] }] }))).toEqual(["no_curriculum_for_year"]));
  it("subjects exist but none mapped yet", () =>
    expect(reasons(base({ subjects: [{ id: "1", name: "DBMS", year: 3, areaKeys: [] }] }))).toEqual(["no_confirmed_mapping"]));
  it("reports every missing precondition together", () =>
    expect(reasons(base({ academicYear: null, subjects: [], targets: [] })).sort()).toEqual(["no_curriculum", "no_target_profile", "year_unknown"]));
});
