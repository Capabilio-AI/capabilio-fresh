/**
 * The Capabilio Curriculum Template, v1. One CSV carries a college's whole curriculum for one branch and regulation: each element of
 * a syllabus is its own row, tagged by `row_type`, so any spreadsheet can produce it and nothing has to be guessed from a layout.
 * The same spec is described for humans in docs/curriculum-template-v1.md.
 */
export const TEMPLATE_VERSION = "v1";

export const COLUMNS = [
  "row_type", "year", "semester", "course_code", "course_title", "kind", "category", "credits",
  "lecture_hours", "tutorial_hours", "practical_hours", "prerequisites", "ref", "text", "value",
] as const;
export type Column = (typeof COLUMNS)[number];

/** Columns a file must have; the rest may be left out when a college has nothing to put in them. */
export const REQUIRED_COLUMNS: readonly Column[] = ["row_type", "course_code"];

export const ROW_TYPES = ["COURSE", "OBJECTIVE", "OUTCOME", "UNIT", "TOPIC", "LAB", "BOOK", "SKILL"] as const;
export type RowType = (typeof ROW_TYPES)[number];

export const KINDS = ["course", "lab", "elective_option", "project", "audit"] as const;
export const BOOK_KINDS = ["text", "reference", "online"] as const;
export const IMPORTANCE = ["CORE", "SUPPORTING", "MINOR"] as const;

/** Rows that start with this marker are notes for the person filling the file. */
export const EXAMPLE_MARKER = "EXAMPLE";

const E = (...cells: string[]) => COLUMNS.map((_, i) => cells[i] ?? "");
const q = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const line = (cells: string[]) => cells.map(q).join(",");

/** The downloadable file: instructions as # lines, the header, then two worked example courses to delete. */
export function templateCsv(): string {
  const notes = [
    `#capabilio-curriculum-template,${TEMPLATE_VERSION}`,
    "# One file = one branch + one regulation. Upload it under Curriculum; you choose the branch and regulation on the upload form.",
    "# Every line below the header is one row. row_type says what the row is: COURSE, OBJECTIVE, OUTCOME, UNIT, TOPIC, LAB, BOOK or SKILL.",
    "# COURSE rows carry year, semester, course_code, course_title and optionally kind, category, credits, hours and prerequisites.",
    "# year = year of study (1-4) and semester = 1 or 2 within it. Or leave year empty and give semester 1-8 for the whole programme.",
    "# kind: course, lab, elective_option, project or audit. Leave empty to let us work it out from the title and category.",
    "# Every other row names its course by course_code (which must match a COURSE row) and uses ref/text/value like this:",
    "#   OBJECTIVE  text = one course objective",
    "#   OUTCOME    ref = CO1, CO2...   text = the outcome   value = Bloom level (Remember..Create) or K1-K6, optional",
    "#   UNIT       ref = unit number   text = unit title    value = hours, optional",
    "#   TOPIC      ref = unit number it belongs to          text = one topic",
    "#   LAB        text = one lab experiment",
    "#   BOOK       ref = text, reference or online          text = the book or link",
    "#   SKILL      text = a skill from the Capabilio skills list   ref = empty (whole course), CO1 or a unit number   value = CORE, SUPPORTING or MINOR",
    "# Only COURSE rows are required. Anything you leave out (outcomes, units, skills) we read or derive from the rest, and you review it before publishing.",
    `# Delete the two ${EXAMPLE_MARKER} courses below before uploading.`,
  ];
  const rows = [
    COLUMNS as unknown as string[],
    E("COURSE", "2", "1", "EX201", `${EXAMPLE_MARKER}: Data Structures`, "course", "Professional Core", "3", "3", "0", "0", "Programming in C"),
    E("OBJECTIVE", "", "", "EX201", "", "", "", "", "", "", "", "", "", "To teach linear and non-linear data structures and their complexity."),
    E("OUTCOME", "", "", "EX201", "", "", "", "", "", "", "", "", "CO1", "Implement stacks, queues and linked lists to solve problems.", "Apply"),
    E("OUTCOME", "", "", "EX201", "", "", "", "", "", "", "", "", "CO2", "Analyse the time complexity of searching and sorting algorithms.", "Analyze"),
    E("UNIT", "", "", "EX201", "", "", "", "", "", "", "", "", "1", "Linear data structures", "10"),
    E("TOPIC", "", "", "EX201", "", "", "", "", "", "", "", "", "1", "Arrays and linked lists"),
    E("TOPIC", "", "", "EX201", "", "", "", "", "", "", "", "", "1", "Stacks and queues"),
    E("UNIT", "", "", "EX201", "", "", "", "", "", "", "", "", "2", "Trees and graphs", "12"),
    E("TOPIC", "", "", "EX201", "", "", "", "", "", "", "", "", "2", "Binary search trees"),
    E("BOOK", "", "", "EX201", "", "", "", "", "", "", "", "", "text", "Data Structures Using C, Reema Thareja"),
    E("SKILL", "", "", "EX201", "", "", "", "", "", "", "", "", "", "Data Structures", "CORE"),
    E("SKILL", "", "", "EX201", "", "", "", "", "", "", "", "", "CO2", "Algorithms", "SUPPORTING"),
    E("COURSE", "2", "1", "EX2L1", `${EXAMPLE_MARKER}: Data Structures Laboratory`, "lab", "Professional Core", "1.5", "0", "0", "3"),
    E("LAB", "", "", "EX2L1", "", "", "", "", "", "", "", "", "", "Implement a stack and a queue using arrays and linked lists."),
    E("LAB", "", "", "EX2L1", "", "", "", "", "", "", "", "", "", "Implement binary search tree insertion, deletion and traversal."),
  ].map(line);
  return `${notes.join("\n")}\n${rows.join("\n")}\n`;
}
