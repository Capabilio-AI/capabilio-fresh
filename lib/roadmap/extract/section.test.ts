import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { extractPdfPages } from "./pdf";
import { chunkSyllabus } from "./chunk";
import { bloomFromK, parseCourseSection } from "./section";
import { detectRegulation, parseProgramOutcomes } from "./programs";

const FIXTURE = new Uint8Array(readFileSync("docs/fixtures/jntuk-r23-btech-cse.pdf"));
let pages: string[] = [];
let courses: ReturnType<typeof chunkSyllabus>["courses"] = [];
const course = (title: RegExp) => courses.find((c) => title.test(c.title))!.parsed;

beforeAll(async () => {
  const r = await extractPdfPages(FIXTURE);
  if (!r.ok) throw new Error(r.code);
  pages = r.pages;
  courses = chunkSyllabus(pages).courses;
}, 60_000);

describe("bloomFromK", () => {
  it("maps K-levels to Bloom's taxonomy and leaves anything else null", () => {
    expect([1, 2, 3, 4, 5, 6].map((k) => bloomFromK(`K${k}`))).toEqual(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]);
    expect(bloomFromK("L3")).toBe("Apply");
    expect(bloomFromK(null)).toBeNull();
    expect(bloomFromK("K9")).toBeNull();
  });
});

describe("a theory course (DBMS) on the real PDF", () => {
  it("reads objectives, outcomes with codes and Bloom levels, units, books and resources", () => {
    const p = course(/^DATABASE MANAGEMENT SYSTEMS$/);
    expect(p.ltpc).toEqual({ l: 3, t: 0, p: 0, c: 3 });
    expect(p.objectives).toHaveLength(4);
    expect(p.objectives[0]).toMatch(/^Introduce database management systems/);
    expect(p.outcomes.map((o) => o.code)).toEqual(["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"]);
    expect(p.outcomes.map((o) => o.bloom)).toEqual(["Understand", "Apply", "Apply", "Apply", "Analyze", "Analyze"]);
    expect(p.outcomes[1].text).toMatch(/^Construct and interpret Entity-Relationship/);
    expect(p.outcomes[1].text).not.toMatch(/\(K3\)/);
    expect(p.units.map((u) => u.unitNo)).toEqual([1, 2, 3, 4, 5]);
    expect(p.textbooks).toHaveLength(2);
    expect(p.textbooks[0]).toMatch(/Raghurama Krishnan/);
    expect(p.referenceBooks).toHaveLength(3);
    expect(p.onlineResources).toHaveLength(2);
  });
  it("splits unit prose into topics and keeps a wrapped URL in one piece", () => {
    const p = course(/^DATABASE MANAGEMENT SYSTEMS$/);
    expect(p.units[0].topics).toEqual(expect.arrayContaining(["Database system", "Database Users", "Three tier schema architecture for data independence"]));
    expect(p.units[3].topics.join("|")).toMatch(/Boyce-Codd normal form\(BCNF\)/);
    expect(p.onlineResources[1]).toMatch(/^https:\/\/infyspringboard\.onwingspan\.com\/.*22456_shared\/overview$/);
    expect(p.onlineResources[1]).not.toMatch(/\s/);
  });
  it("never lets the CO/PO matrix or the L T P C footer leak into any field", () => {
    for (const c of courses) {
      const everything = [...c.parsed.objectives, ...c.parsed.outcomes.map((o) => o.text), ...c.parsed.units.flatMap((u) => u.topics), ...c.parsed.experiments, ...c.parsed.textbooks, ...c.parsed.referenceBooks];
      for (const s of everything) {
        expect(s).not.toMatch(/^[HML-](\s+[HML-]){3,}/);
        expect(s).not.toMatch(/\bL T P C\b/);
        expect(s).not.toMatch(/^PO1 PO2/);
      }
    }
  });
  it("keeps raw source snippets as provenance for what it extracted", () => {
    const p = course(/^DATABASE MANAGEMENT SYSTEMS$/);
    expect(p.provenance.outcomes).toMatch(/CO1: Explain the fundamental concepts/);
    expect(p.provenance.units).toMatch(/UNIT I/);
    expect(Object.values(p.provenance).every((s) => s.length <= 400)).toBe(true);
  });
});

describe("a lab course (DBMS Lab) on the real PDF", () => {
  it("reads the numbered experiments across a page break, folding sub-steps into their experiment", () => {
    const p = course(/^DATABASE MANAGEMENT SYSTEMS LAB$/);
    expect(p.ltpc).toEqual({ l: 0, t: 0, p: 3, c: 1.5 });
    expect(p.experiments).toHaveLength(15);
    expect(p.experiments[4]).toMatch(/Create a simple PL\/SQL program/);
    expect(p.experiments[4]).toMatch(/COMMIT, ROLLBACK and SAVEPOINT/);
    expect(p.experiments[14]).toMatch(/delete values from it/);
    expect(p.units).toEqual([]);
  });
});

describe("whole document", () => {
  it("parses something useful from most courses and states what it could not", () => {
    const withStructure = courses.filter((c) => c.parsed.complete);
    expect(withStructure.length).toBeGreaterThanOrEqual(courses.length * 0.7);
    expect(courses.filter((c) => c.parsed.units.length > 0).length).toBeGreaterThanOrEqual(25);
    expect(courses.filter((c) => c.parsed.textbooks.length > 0).length).toBeGreaterThanOrEqual(30);
    expect(courses.filter((c) => c.parsed.prerequisites).length).toBeGreaterThanOrEqual(3);
  });
  it("finds L-T-P-C when it trails the title line, and keeps unstated credits null", () => {
    expect(course(/^COMPUTER NETWORKS$/).ltpc).toEqual({ l: 3, t: 0, p: 0, c: 3 });
    expect(course(/^TECHNICAL PAPER WRITING/).ltpc).toEqual({ l: 2, t: 0, p: 0, c: null });
    expect(courses.filter((c) => c.parsed.ltpc).length).toBeGreaterThanOrEqual(courses.length - 3);
  });
  it("numbers units by appearance when a section repeats UNIT I, so (course, unit) stays unique", () => {
    for (const c of courses) {
      const nos = c.parsed.units.map((u) => u.unitNo);
      expect(new Set(nos).size).toBe(nos.length);
    }
  });
  it("calls a lab complete when it has experiments, even from the topic list", () => {
    expect(course(/^ADVANCED DATA STRUCTURES & ALGORITHM ANALYSIS LAB/).complete).toBe(true);
  });
  it("never invents a field the PDF does not state", () => {
    for (const c of courses) {
      expect(c.parsed.ltpc === null || [c.parsed.ltpc.l, c.parsed.ltpc.t, c.parsed.ltpc.p, c.parsed.ltpc.c ?? 0].every((n) => n >= 0 && n <= 40)).toBe(true);
      if (c.parsed.outcomes.length === 0) expect(c.parsed.provenance.outcomes).toBeUndefined();
    }
  });
});

describe("programme outcomes and regulation", () => {
  it("reads PO1–PO12 and PSO1–PSO3 with their full text", () => {
    const { pos, psos } = parseProgramOutcomes(pages);
    expect(pos.map((p) => p.code)).toEqual(Array.from({ length: 12 }, (_, i) => `PO${i + 1}`));
    expect(pos[0].text).toMatch(/^Engineering knowledge: Apply the knowledge of mathematics/);
    expect(pos[9].text).toMatch(/give and receive clear instructions\.$/);
    expect(psos.map((p) => p.code)).toEqual(["PSO1", "PSO2", "PSO3"]);
    expect(psos[0].text).toMatch(/^Design algorithms for real-world computational problems/);
    expect(psos[0].text).not.toMatch(/^"|"$/);
  });
  it("finds the regulation in the running header and nowhere else", () => {
    expect(detectRegulation("JAWAHARLAL NEHRU TECHNOLOGICAL UNIVERSITY KAKINADA\nR23 B.Tech CSE COURSE STRUCTURE")).toEqual({ regulation: "R23", program: "B.Tech" });
    expect(detectRegulation("Course Outcomes: students will use R2 values")).toEqual({ regulation: null, program: null });
  });
});
