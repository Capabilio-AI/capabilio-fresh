import { describe, expect, it } from "vitest";
import { cleaningTool, type CleaningContent } from "@/lib/arena-workstations/tools/cleaning";
import { dashboardTool } from "@/lib/arena-workstations/tools/dashboard";
import { statisticsTool, type StatisticsContent } from "@/lib/arena-workstations/tools/statistics";
import type { BiSpec } from "@/lib/arena-workstations/engines/bi";
import type { ExpectedAnswer } from "@/lib/arena-workstations/engines/stats";
import { spreadsheetTool, type SpreadsheetPublicContent } from "@/lib/arena-workstations/tools/spreadsheet";
import type { CleaningStep } from "@/lib/arena-workstations/engines/cleaning";
import { hashSeed } from "./rng";
import { solveSheet } from "./office/solver";

const ctx = (areaKey: string, userId: string, n: number, difficulty: "easy" | "medium" | "hard", avoid: string[] = []) => ({
  roleName: "Data Analyst", parentSkill: "Data Analysis", areaName: areaKey, difficulty, avoidTitles: avoid, level: "senior" as const, recentKinds: [],
  roleKey: "data-analyst", areaKey, worldSeed: hashSeed(userId, "data-analyst", "world"), ticketSeed: hashSeed(userId, "data-analyst", "ticket", n),
});

describe("spreadsheet tool on the company data (no AI call)", () => {
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    it(`${difficulty}: a ticket the right formulas solve and typed numbers or nothing do not`, async () => {
      const g = await spreadsheetTool.generate(ctx("spreadsheet", "u-sheet", 0, difficulty));
      expect(g.origin?.provider).toBe("template");
      const content = g.content as unknown as SpreadsheetPublicContent;
      expect(content.company).toBe("BrightCart");
      expect(g.requester).toMatch(/·/);
      const cells = solveSheet(content, content.layout);
      expect((await spreadsheetTool.grade(g.content, g.answer_key, { cells })).passed).toBe(true);
      expect((await spreadsheetTool.grade(g.content, g.answer_key, { cells: {} })).passed).toBe(false);
    });
  }

  it("never repeats a title it was told to avoid, and differs per user", async () => {
    const first = await spreadsheetTool.generate(ctx("spreadsheet", "u-sheet-2", 0, "medium"));
    const next = await spreadsheetTool.generate(ctx("spreadsheet", "u-sheet-2", 1, "medium", [first.title]));
    expect(next.title).not.toBe(first.title);
    const other = await spreadsheetTool.generate(ctx("spreadsheet", "u-sheet-3", 0, "medium"));
    expect(JSON.stringify(other.content)).not.toBe(JSON.stringify(first.content));
  });
});

describe("cleaning tool on a large messy export (no AI call)", () => {
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    it(`${difficulty}: the reference steps pass, an empty pipeline fails, and another valid order passes`, async () => {
      const g = await cleaningTool.generate(ctx("data_cleaning", "u-clean", 0, difficulty));
      expect(g.origin?.provider).toBe("template");
      const content = g.content as unknown as CleaningContent;
      expect(content.dataset.rows.length).toBeGreaterThanOrEqual(80);
      expect(content.requirements.length).toBeGreaterThanOrEqual(3);
      const steps = (g.answer_key as unknown as { steps: CleaningStep[] }).steps;
      expect((await cleaningTool.grade(g.content, g.answer_key, { steps })).passed).toBe(true);
      expect((await cleaningTool.grade(g.content, g.answer_key, { steps: [] })).passed).toBe(false);
      const dedupeFirst = [...steps.filter((s) => s.op === "dedupe"), ...steps.filter((s) => s.op !== "dedupe")];
      expect((await cleaningTool.grade(g.content, g.answer_key, { steps: dedupeFirst })).passed).toBe(true);
    });
  }
});

describe("dashboard tool on the company data (no AI call)", () => {
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    it(`${difficulty}: the intended chart passes and a different one fails`, async () => {
      const g = await dashboardTool.generate(ctx("dashboard", "u-dash", 0, difficulty));
      expect(g.origin?.provider).toBe("template");
      const spec = (g.answer_key as unknown as { spec: BiSpec }).spec;
      expect((await dashboardTool.grade(g.content, g.answer_key, { spec })).passed).toBe(true);
      expect((await dashboardTool.grade(g.content, g.answer_key, { spec: { ...spec, filters: [] } })).passed).toBe(false);
      expect(JSON.stringify(g.content)).not.toContain("answer_key");
    });
  }
});

describe("statistics tool on the company data (no AI call)", () => {
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    it(`${difficulty}: correct answers pass and wrong ones fail`, async () => {
      const g = await statisticsTool.generate(ctx("statistics", "u-stat", 0, difficulty));
      expect(g.origin?.provider).toBe("template");
      const content = g.content as unknown as StatisticsContent;
      expect(content.dataset.rows.length).toBeGreaterThanOrEqual(30);
      const expected = (g.answer_key as unknown as { expected: ExpectedAnswer[] }).expected;
      const right = Object.fromEntries(expected.map((e) => [e.key, String(e.value)]));
      expect((await statisticsTool.grade(g.content, g.answer_key, { answers: right })).passed).toBe(true);
      expect((await statisticsTool.grade(g.content, g.answer_key, { answers: {} })).passed).toBe(false);
    });
  }
});
