import { describe, expect, it } from "vitest";
import { chunkSyllabus } from "./chunk";
import { detectRegulation } from "./programs";

// Excerpts of the semester-numbered layout used by autonomous colleges ("MIC23"): no "Year" in the headings.
const PAGES = [
  `DVR & Dr. HS MIC College of Technology MIC23 (w.e.f. 2023-24)
(Autonomous)
COURSE STRUCTURE
B.TECH, I SEMESTER
S.No Course
Category
Course
Code Name of the Course Course
Type
1 BS&H 23CS1T01 Communicative English T 2 – 0 – 0 30 70 100 2
Total Number of Credits 19
B.TECH, III SEMESTER
S.No Course
Category
1 PC 23CS3T04 Advanced Data Structures T 3 – 0 – 0 30 70 100 3
Total Number of Credits 20`,
  `B.TECH I SEMESTER ES L T P C
3 0 0 3
23CS1T04 INTRODUCTION TO PROGRAMMING
Course Objectives:
To introduce students to the fundamentals of computer programming.
Course Outcomes: A student after completion of the course will be able to
CO1: Understand basics of computers.
CO2: Analyze a problem and develop a program.`,
  `B.TECH VII SEMESTER OE L T P C
3 0 0 3
23CE7T09 BUILDING MATERIALS FOR ENGINEERS
Course Objectives:
To study materials.`,
  `B.TECH III SEMESTER PC L T P C
3 0 0 3
23CS3T04 ADVANCED DATA STRUCTURES
AND ALGORITHM ANALYSIS
Course Objectives:
To study structures.
Course Outcomes: A student will be able to
CO1: Apply trees.`,
];

describe("chunkSyllabus: semester-numbered layout", () => {
  const { tables, courses } = chunkSyllabus(PAGES);

  it("finds one table per semester and maps semester n to year/semester", () => {
    expect(tables.map((t) => [t.year, t.semester])).toEqual([[1, 1], [2, 1]]);
    expect(tables[0].text).toContain("Communicative English");
    expect(tables[0].text).not.toContain("Advanced Data Structures");
  });

  it("reads course sections titled by the course-code line, skipping open-elective pools", () => {
    expect(courses.map((c) => c.title)).toEqual(["INTRODUCTION TO PROGRAMMING", "ADVANCED DATA STRUCTURES AND ALGORITHM ANALYSIS"]);
    expect(courses[0]).toMatchObject({ year: 1, semester: 1 });
    expect(courses[0].parsed.ltpc).toEqual({ l: 3, t: 0, p: 0, c: 3 });
    expect(courses[0].outcomes).toHaveLength(2);
    expect(courses[1]).toMatchObject({ year: 2, semester: 1 });
  });
});

describe("detectRegulation: running-header style", () => {
  it("reads MIC23 from 'MIC23 (w.e.f. 2023-24)' and the programme from the semester heading", () => {
    expect(detectRegulation(PAGES[0])).toEqual({ regulation: "MIC23", program: "B.Tech" });
  });
  it("still reads the JNTUK 'R23 B.Tech' header first", () => {
    expect(detectRegulation("R23 B.Tech COMPUTER SCIENCE COURSE STRUCTURE")).toEqual({ regulation: "R23", program: "B.Tech" });
  });
});

import { parseSemesterHeading } from "./semester-heading";

describe("parseSemesterHeading: other colleges' phrasings", () => {
  const n = (s: string) => parseSemesterHeading(s)?.n ?? null;
  it("reads the common ways a semester is written", () => {
    expect([n("B.TECH, I SEMESTER"), n("SEMESTER - III"), n("3rd Semester"), n("Semester 4"), n("Sem V"), n("First Semester"), n("B.E. VI SEM"), n("B.TECH: II SEMESTER")]).toEqual([1, 3, 3, 4, 5, 1, 6, 2]);
  });
  it("leaves year-based headings and prose alone", () => {
    expect(n("II Year I Semester")).toBeNull();
    expect(n("Semester 9")).toBeNull();
    expect(n("Students must register for each semester before the deadline announced by the controller of examinations.")).toBeNull();
    expect(n("Seminar on emerging technologies")).toBeNull();
  });
});

describe("chunkSyllabus: another college's headings", () => {
  const pages = [
    `SCHEME OF INSTRUCTION
SEMESTER - III
Sl.No Subject Code Subject Name L T P Credits
1 CS301 Data Structures 3 0 0 3
2 CS302 Discrete Mathematics 3 1 0 4
Total Credits 7`,
    `Semester III
Course Title: Data Structures
Course Code: CS301
Course Outcomes:
CO1: Implement linked lists.`,
    `Semester I examinations will be held in December. Nothing here is a course.
Please contact the office.`,
  ];
  it("finds the table and the labelled course section without any college-specific rule", () => {
    const { tables, courses } = chunkSyllabus(pages);
    expect(tables.map((t) => [t.year, t.semester])).toEqual([[2, 1]]);
    expect(courses.map((c) => c.title)).toEqual(["Data Structures"]);
  });
});
