import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { checkPdfBytes, extractPdfPages, MAX_PDF_BYTES } from "./pdf";
import { chunkSyllabus, trimTable } from "./chunk";
import { buildCandidates, ExtractionError, type ExtractionDeps } from "./build";
import { isGrounded } from "./structure";
import { mergeRows, sameCourse, type BaseRow } from "./merge";
import { toRecord, STALE_AFTER_MS } from "./store";
import { parseCourseSection } from "./section";

// The real JNTUK R23 B.Tech CSE syllabus (158 pages) — not a synthetic file.
const FIXTURE = new Uint8Array(readFileSync("docs/fixtures/jntuk-r23-btech-cse.pdf"));
let pages: string[] = [];
let chunks: ReturnType<typeof chunkSyllabus>;

beforeAll(async () => {
  const r = await extractPdfPages(FIXTURE);
  if (!r.ok) throw new Error(r.code);
  pages = r.pages;
  chunks = chunkSyllabus(pages);
}, 60_000);

describe("real fixture: text extraction and chunking", () => {
  it("reads all 158 pages and strips the running page header", () => {
    expect(pages).toHaveLength(158);
    expect(pages.join("\n")).not.toContain("JAWAHARLAL NEHRU TECHNOLOGICAL UNIVERSITY");
  });
  it("finds exactly one course table per semester, II-I through IV-II, and never sends the whole document", () => {
    expect(chunks.tables.map((t) => `${t.year}-${t.semester}`)).toEqual(["2-1", "2-2", "3-1", "3-2", "4-1", "4-2"]);
    for (const t of chunks.tables) expect(t.text.length).toBeLessThan(4000);
  });
  it("drops the Minor/Honors/MOOC pools listed after a semester's Total row", () => {
    const t32 = chunks.tables.find((t) => t.year === 3 && t.semester === 2)!.text;
    expect(t32).toContain("Compiler Design");
    expect(t32).not.toMatch(/Minor Course|Honors Course/);
    const t42 = chunks.tables.find((t) => t.year === 4 && t.semester === 2)!.text;
    expect(t42).not.toMatch(/Parallel Computer Architecture|Minor in CSE/);
  });
  it("attributes course sections to the right year and semester", () => {
    const at = (title: RegExp) => chunks.courses.find((c) => title.test(c.title));
    expect(at(/^DATABASE MANAGEMENT SYSTEMS$/)).toMatchObject({ year: 2, semester: 2 });
    expect(at(/^COMPUTER NETWORKS$/)).toMatchObject({ year: 3, semester: 1 });
    expect(at(/^COMPILER DESIGN$/)).toMatchObject({ year: 3, semester: 2 });
    expect(at(/^DEEP LEARNING$/)).toMatchObject({ year: 4, semester: 1 });
    expect(chunks.courses.length).toBeGreaterThanOrEqual(55);
  });
  it("parses Course Outcomes in every format the document uses (CO1:, numbered, bulleted)", () => {
    const outcomes = (title: RegExp) => chunks.courses.find((c) => title.test(c.title))!.outcomes;
    expect(outcomes(/^DISCRETE MATHEMATICS/)).toHaveLength(5); // CO1: …
    expect(outcomes(/^PROBABILITY AND STATISTICS/)).toHaveLength(5); // 1. …
    expect(outcomes(/^CLOUD COMPUTING LAB/)).toHaveLength(5); // bullets
    expect(outcomes(/^DATABASE MANAGEMENT SYSTEMS$/)[0]).not.toMatch(/\(K\d\)$/);
    expect(chunks.courses.filter((c) => c.outcomes.length > 0).length).toBeGreaterThanOrEqual(25);
  });
  it("never mistakes the CO/PO matrix rows for outcomes", () => {
    for (const c of chunks.courses) for (const o of c.outcomes) expect(o).not.toMatch(/^[HML-](\s+[HML-]){3,}/);
  });
});

describe("file validation", () => {
  it("accepts the real syllabus", () => expect(checkPdfBytes(FIXTURE)).toEqual({ ok: true }));
  it("rejects a non-PDF whatever it is called", () => {
    expect(checkPdfBytes(new TextEncoder().encode("<html>not a pdf</html>"))).toMatchObject({ ok: false, status: 415 });
  });
  it("rejects an empty file and an oversized one before any processing", () => {
    expect(checkPdfBytes(new Uint8Array(0))).toMatchObject({ ok: false, status: 400 });
    const big = new Uint8Array(MAX_PDF_BYTES + 1);
    big.set(new TextEncoder().encode("%PDF-1.7"));
    expect(checkPdfBytes(big)).toMatchObject({ ok: false, status: 413 });
  });
  it("gives an honest no_text_layer failure for a PDF with no selectable text (a scan)", async () => {
    const scan = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF"
    );
    expect(await extractPdfPages(scan)).toEqual({ ok: false, code: "no_text_layer" });
  });
  it("reports a damaged file as unreadable, not garbage", async () => {
    expect(await extractPdfPages(new TextEncoder().encode("%PDF-1.4 garbage"))).toMatchObject({ ok: false });
  });
});

describe("matching and grounding", () => {
  it("matches the same course across the table and the course section", () => {
    expect(sameCourse("Full Stack Development –I", "FULL STACK DEVELOPMENT – 1")).toBe(true);
    expect(sameCourse("Soft skills / / SWAYAM Plus - 21st Century Employability Skills", "SOFT SKILLS")).toBe(true);
    expect(sameCourse("Database Management Systems", "DATABASE MANAGEMENT SYSTEMS")).toBe(true);
  });
  it("never confuses a course with its lab, or two different courses", () => {
    expect(sameCourse("Operating Systems Lab", "OPERATING SYSTEMS")).toBe(false);
    expect(sameCourse("Operating Systems", "OPERATING SYSTEMS LAB")).toBe(false);
    expect(sameCourse("Computer Networks", "Computer Organization")).toBe(false);
  });
  it("only trusts names that appear in the source text", () => {
    expect(isGrounded("Compiler Design", "1 Professional Core Compiler Design 3 0 0 3")).toBe(true);
    expect(isGrounded("Quantum Basket Weaving", "1 Professional Core Compiler Design 3 0 0 3")).toBe(false);
  });
  it("trims a table at its Total row", () => {
    expect(trimTable("B.Tech. II Year I Semester\n1 A 3\nTotal 3\nMinor Course x")).toBe("B.Tech. II Year I Semester\n1 A 3\nTotal 3");
  });
});

// Deterministic stand-ins for the two AI calls: the pipeline's own logic is what these tests exercise.
const row = (year: number, semester: number, name: string, extra: Partial<BaseRow> = {}): BaseRow => ({ year, semester, name, code: null, category: "Professional Core", kind: "course", confidence: "high", needsReview: false, reason: null, ...extra });
const okDeps = (over: Partial<ExtractionDeps> = {}): ExtractionDeps => ({
  structureSemester: async (c) => (c.year === 2 && c.semester === 2 ? [row(2, 2, "Database Management Systems"), row(2, 2, "Operating Systems Lab", { kind: "lab" })] : []),
  suggestAreas: async (items) => new Map(items.map((i) => [i.id, /database/i.test(i.title) ? ["sql"] : []])),
  ...over,
});
const ctx = { roleName: "Data Analyst", areas: [{ key: "sql", name: "SQL" }] };

describe("pipeline on the real fixture (AI stubbed)", () => {
  it("attributes subjects to their semester and suggests a mapping only where outcomes support one", async () => {
    const { rows } = await buildCandidates(pages, ctx, okDeps(), () => undefined);
    const dbms = rows.find((r) => r.name === "Database Management Systems" && r.year === 2)!;
    expect(dbms).toMatchObject({ semester: 2, mappingNote: "suggested", suggestedAreaKeys: ["sql"] });
    expect(dbms.outcomesCount).toBeGreaterThanOrEqual(5);
    const lab = rows.find((r) => r.name === "Operating Systems Lab")!;
    expect(lab).toMatchObject({ mappingNote: "no_outcomes", suggestedAreaKeys: [] }); // no CO text → no guess
  });
  it("shows course sections missing from the table as needs-review, never silently dropping them", async () => {
    const { rows } = await buildCandidates(pages, ctx, okDeps(), () => undefined);
    const orphan = rows.find((r) => /compiler design/i.test(r.name))!;
    expect(orphan).toMatchObject({ year: 3, semester: 2, needsReview: true, confidence: "low" });
    expect(orphan.reason).toMatch(/not in the semester table/);
  });
  it("a failed semester becomes a visible warning and the rest still completes", async () => {
    const deps = okDeps({ structureSemester: async (c) => { if (c.year === 3 && c.semester === 1) throw new Error("boom"); return []; } });
    const r = await buildCandidates(pages, ctx, deps, () => undefined);
    expect(r.warnings.join(" ")).toMatch(/Year 3 · Semester 1/);
    expect(r.rows.length).toBeGreaterThan(20);
  });
  it("a failed suggestion batch leaves rows unmapped with a warning, not a guessed mapping", async () => {
    const r = await buildCandidates(pages, ctx, okDeps({ suggestAreas: async () => { throw new Error("down"); } }), () => undefined);
    expect(r.rows.every((x) => x.suggestedAreaKeys.length === 0)).toBe(true);
    expect(r.rows.some((x) => x.mappingNote === "not_attempted")).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/Suggest/);
  });
  it("calls the model per semester and per small batch — never once for the document", async () => {
    let structureCalls = 0;
    let maxItems = 0;
    await buildCandidates(pages, ctx, okDeps({ structureSemester: async () => (structureCalls++, []), suggestAreas: async (items) => (maxItems = Math.max(maxItems, items.length), new Map()) }), () => undefined);
    expect(structureCalls).toBe(6);
    expect(maxItems).toBeLessThanOrEqual(10);
  });
  it("reports progress up to the total", async () => {
    const seen: [number, number][] = [];
    await buildCandidates(pages, ctx, okDeps(), (d, t) => void seen.push([d, t]));
    const [d, t] = seen[seen.length - 1];
    expect(d).toBe(t);
  });
  it("rejects a document with no recognisable semesters instead of inventing structure", async () => {
    await expect(buildCandidates(["Just a brochure about the college.\nNo tables here."], ctx, okDeps(), () => undefined)).rejects.toBeInstanceOf(ExtractionError);
  });
});

describe("merge", () => {
  it("keeps table rows authoritative", () => {
    const { rows } = mergeRows([row(2, 1, "Python Programming")], [{ year: 2, semester: 1, title: "PYTHON PROGRAMMING (SKILL ENHANCEMENT COURSE)", outcomes: ["Apply python to solve problems"], text: "", parsed: parseCourseSection([]) }]);
    expect(rows).toHaveLength(1);
  });
});

describe("staged record", () => {
  const base = { id: "i", branch: "CSE", file_name: "s.pdf", chunks_done: 0, chunks_total: 0, error_code: null, result: null, created_at: "2026-01-01T00:00:00Z" };
  it("a job whose instance died is shown as failed, not processing forever", () => {
    const now = Date.parse("2026-01-01T01:00:00Z");
    const stale = toRecord({ ...base, status: "processing", updated_at: new Date(now - STALE_AFTER_MS - 1000).toISOString() }, now);
    expect(stale).toMatchObject({ status: "failed", errorCode: "internal" });
    expect(toRecord({ ...base, status: "processing", updated_at: new Date(now - 1000).toISOString() }, now).status).toBe("processing");
  });
  it("a malformed stored result is never handed to the UI", () => {
    expect(toRecord({ ...base, status: "ready", result: { rows: [{ nope: 1 }] }, updated_at: base.created_at }).result).toBeNull();
  });
});
