import { describe, expect, it } from "vitest";
import { composition, courseGroup, yearCoverage } from "./composition";

describe("courseGroup", () => {
  it("classifies by kind, and by an 'elective' category when the kind is a plain course", () => {
    expect(courseGroup({ kind: "lab", category: null })).toBe("lab");
    expect(courseGroup({ kind: "elective_option", category: "PE-I" })).toBe("elective");
    expect(courseGroup({ kind: "course", category: "Professional Elective" })).toBe("elective");
    expect(courseGroup({ kind: "audit", category: null })).toBe("other");
    expect(courseGroup({ kind: "course", category: "Core" })).toBe("core");
  });
});

describe("composition", () => {
  it("counts every course into exactly one group", () => {
    const rows = [
      { kind: "course", category: null }, { kind: "course", category: null }, { kind: "lab", category: null },
      { kind: "elective_option", category: null }, { kind: "project", category: null },
    ];
    expect(composition(rows)).toEqual({ core: 2, lab: 1, elective: 1, other: 1 });
  });
});

describe("yearCoverage", () => {
  it("always reports years 1-4 so an empty year shows as 0", () => {
    expect(yearCoverage([{ year: 1 }, { year: 1 }, { year: 3 }])).toEqual([
      { year: 1, courses: 2 }, { year: 2, courses: 0 }, { year: 3, courses: 1 }, { year: 4, courses: 0 },
    ]);
  });
  it("keeps a year outside the usual range", () => {
    expect(yearCoverage([{ year: 5 }]).map((y) => y.year)).toEqual([1, 2, 3, 4, 5]);
  });
});
