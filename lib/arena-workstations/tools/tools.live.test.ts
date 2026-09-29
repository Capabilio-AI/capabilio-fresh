import { describe, expect, it } from "vitest";
import type { Json } from "@/lib/supabase/types";
import { toolFor } from "../registry";
import { columnLetters } from "../engines/formula";
import type { SpreadsheetPublicContent } from "./spreadsheet";
import type { GenerationContext } from "../types";

// Live: calls the real AI provider and Wandbox. Proves each generation
// contract produces instances that validate, that the server's own answer
// passes the grader, and that a wrong answer fails.
const ctx = (areaName: string): GenerationContext => ({ roleName: "Data Analyst", parentSkill: "Data Analysis", areaName, difficulty: "easy", avoidTitles: [] });

// Same bounded policy as production (attempts.ts GENERATION_ATTEMPTS = 3).
async function generate(toolType: string, area: string) {
  const tool = toolFor(toolType);
  let last: unknown;
  for (let i = 1; i <= 3; i++) {
    try {
      return await tool.generate(ctx(area));
    } catch (e) {
      last = e;
      console.warn(`[${toolType}] attempt ${i} rejected: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  throw last;
}

function referenceFormulas(content: SpreadsheetPublicContent): Record<string, string> {
  const col = (name: string) => columnLetters(content.data.columns.findIndex((c) => c.name === name));
  const n = content.data.rows.length;
  const cells: Record<string, string> = {};
  content.tasks.forEach((t, i) => {
    const target = content.layout.targets[i];
    if (t.type === "row_formula") {
      const expr: Record<string, (l: string, r: string) => string> = {
        multiply: (l, r) => `${l}*${r}`, divide: (l, r) => `${l}/${r}`, add: (l, r) => `${l}+${r}`, subtract: (l, r) => `${l}-${r}`,
        percent_change: (l, r) => `(${r}-${l})/${l}*100`, percent_of: (l, r) => `${l}/${r}*100`,
      };
      target.cells.forEach((cell, r) => (cells[cell] = `=ROUND(${expr[t.op](`${col(t.left)}${r + 2}`, `${col(t.right)}${r + 2}`)},${t.decimals})`));
    } else if (t.type === "lookup") {
      const start = Object.entries(content.layout.cells).find(([addr, v]) => addr.endsWith("1") && v === content.lookup!.columns[0].name && addr !== `${col(t.key_column)}1`)![0].replace(/\d+$/, "");
      const startIdx = start.split("").reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const range = `$${start}$2:$${columnLetters(startIdx + 1)}$${content.lookup!.rows.length + 1}`;
      target.cells.forEach((cell, r) => (cells[cell] = `=VLOOKUP(${col(t.key_column)}${r + 2},${range},2,FALSE)`));
    } else if (t.type === "summary") {
      cells[target.cells[0]] = `=ROUND(${t.fn}(${col(t.column)}2:${col(t.column)}${n + 1}),${t.decimals})`;
    } else {
      const crit = `${col(t.criteria_column)}2:${col(t.criteria_column)}${n + 1}`;
      const vals = `${col(t.column)}2:${col(t.column)}${n + 1}`;
      cells[target.cells[0]] = t.fn === "COUNTIF" ? `=COUNTIF(${crit},"${t.criteria_value}")` : `=ROUND(${t.fn}(${crit},"${t.criteria_value}",${vals}),${t.decimals})`;
    }
  });
  return cells;
}

describe("live generation → grading, per tool", () => {
  it("SQL", async () => {
    const tool = toolFor("sql_workspace");
    const g = await generate("sql_workspace", "SQL");
    const key = g.answer_key as { reference_query: string };
    expect(JSON.stringify(g.content)).not.toContain(key.reference_query);
    expect((await tool.grade(g.content, g.answer_key, { query: key.reference_query })).passed).toBe(true);
    expect((await tool.grade(g.content, g.answer_key, { query: "SELECT 1" })).passed).toBe(false);
  });

  it("Statistics", async () => {
    const tool = toolFor("statistics_workspace");
    const g = await generate("statistics_workspace", "Statistics");
    const key = g.answer_key as { expected: { key: string; value: number | string }[] };
    const answers = Object.fromEntries(key.expected.map((e) => [e.key, typeof e.value === "number" ? e.value.toFixed(3) : e.value]));
    expect((await tool.grade(g.content, g.answer_key, { answers })).passed).toBe(true);
    const wrong = Object.fromEntries(key.expected.map((e) => [e.key, typeof e.value === "number" ? String(e.value * 1.2 + 1) : "No"]));
    expect((await tool.grade(g.content, g.answer_key, { answers: wrong })).passed).toBe(false);
  });

  it("Data Cleaning", async () => {
    const tool = toolFor("cleaning_workspace");
    const g = await generate("cleaning_workspace", "Data Cleaning");
    const key = g.answer_key as { steps: unknown[] };
    expect((await tool.grade(g.content, g.answer_key, { steps: key.steps })).passed).toBe(true);
    expect((await tool.grade(g.content, g.answer_key, { steps: key.steps.slice(1) })).passed).toBe(false);
  });

  it("BI / Dashboarding", async () => {
    const tool = toolFor("dashboard_workspace");
    const g = await generate("dashboard_workspace", "BI / Dashboarding");
    const key = g.answer_key as { spec: Record<string, unknown> };
    expect((await tool.grade(g.content, g.answer_key, { spec: key.spec })).passed).toBe(true);
    const wrongAgg = key.spec.aggregation === "count" ? "sum" : "count";
    const wrong = { ...key.spec, aggregation: wrongAgg, measure: wrongAgg === "count" ? null : key.spec.measure };
    expect((await tool.grade(g.content, g.answer_key, { spec: wrong })).passed).toBe(false);
  });

  it("Excel / Spreadsheets", async () => {
    const tool = toolFor("spreadsheet_workspace");
    const g = await generate("spreadsheet_workspace", "Excel / Spreadsheets");
    const content = g.content as unknown as SpreadsheetPublicContent;
    const cells = referenceFormulas(content);
    const res = await tool.grade(g.content, g.answer_key, { cells });
    expect(res.checks.filter((c) => !c.passed)).toEqual([]);
    const hardcoded = Object.fromEntries(Object.keys(cells).map((k) => [k, "1"]));
    expect((await tool.grade(g.content as Json, g.answer_key, { cells: hardcoded })).passed).toBe(false);
  });
});
