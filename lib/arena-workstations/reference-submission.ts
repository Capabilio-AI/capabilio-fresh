import { columnLetters } from "./engines/formula";
import type { SpreadsheetPublicContent } from "./tools/spreadsheet";
import { referenceNote, type NoteKey } from "@/lib/workplace/findings-note";

// TEST SUPPORT ONLY (*.live.test.ts): builds the correct submission for a
// generated instance from its server-side answer key, to drive end-to-end
// tests through the real grader. Never imported by app code.
export function referenceSubmission(toolType: string, content: unknown, answerKey: unknown): unknown {
  const key = answerKey as Record<string, unknown>;
  switch (toolType) {
    case "sql_workspace":
      // a query task has a reference query; a script task (UPDATE, ALTER, ...) has a reference script, submitted the same way
      return { query: key.reference_query ?? key.reference_script };
    case "statistics_workspace":
      return { answers: Object.fromEntries((key.expected as { key: string; value: number | string }[]).map((e) => [e.key, typeof e.value === "number" ? e.value.toFixed(3) : e.value])) };
    case "code_workspace":
      // the student's code runs in their browser and what they submit is what it returned; the reference is the answers the server holds
      return { language: "javascript", outputs: (key.expected as unknown[]).map((value) => ({ ok: true, value })) };
    case "cleaning_workspace":
      return { steps: key.steps };
    case "dashboard_workspace":
      return { spec: key.spec, note: key.note ? referenceNote(key.note as NoteKey) : undefined };
    case "investigation_workspace":
      return { answers: key.answers, note: key.note ? referenceNote(key.note as NoteKey) : undefined };
    case "spreadsheet_workspace":
      return { cells: referenceFormulas(content as SpreadsheetPublicContent), pivots: referencePivots(content as SpreadsheetPublicContent) };
    default:
      throw new Error(`no reference submission for ${toolType}`);
  }
}

/** The PivotTable setup that answers each pivot task, keyed by task index. */
export function referencePivots(content: SpreadsheetPublicContent): Record<string, { rows: string; values: string | null; fn: "SUM" | "AVERAGE" | "COUNT" }> {
  const out: Record<string, { rows: string; values: string | null; fn: "SUM" | "AVERAGE" | "COUNT" }> = {};
  content.tasks.forEach((t, i) => {
    if (t.type === "pivot") out[String(i)] = { rows: t.row_column, values: t.value_column, fn: t.fn };
  });
  return out;
}

export function referenceFormulas(content: SpreadsheetPublicContent): Record<string, string> {
  const col = (name: string) => columnLetters(content.data.columns.findIndex((c) => c.name === name));
  const n = content.data.rows.length;
  const cells: Record<string, string> = {};
  const lookupStartIdx = content.data.columns.length + content.tasks.filter((t) => t.type === "row_formula" || t.type === "lookup").length + 1;
  content.tasks.forEach((t, i) => {
    const target = content.layout.targets[i];
    if (t.type === "row_formula") {
      const expr: Record<string, (l: string, r: string) => string> = {
        multiply: (l, r) => `${l}*${r}`, divide: (l, r) => `${l}/${r}`, add: (l, r) => `${l}+${r}`, subtract: (l, r) => `${l}-${r}`,
        percent_change: (l, r) => `(${r}-${l})/${l}*100`, percent_of: (l, r) => `${l}/${r}*100`,
      };
      target.cells.forEach((cell, r) => (cells[cell] = `=ROUND(${expr[t.op](`${col(t.left)}${r + 2}`, `${col(t.right)}${r + 2}`)},${t.decimals})`));
    } else if (t.type === "lookup") {
      const range = `$${columnLetters(lookupStartIdx)}$2:$${columnLetters(lookupStartIdx + 1)}$${content.lookup!.rows.length + 1}`;
      target.cells.forEach((cell, r) => (cells[cell] = `=VLOOKUP(${col(t.key_column)}${r + 2},${range},2,FALSE)`));
    } else if (t.type === "summary") {
      cells[target.cells[0]] = `=ROUND(${t.fn}(${col(t.column)}2:${col(t.column)}${n + 1}),${t.decimals})`;
    } else if (t.type === "pivot") {
      // a PivotTable has no cells: the reference setup is returned by referencePivots
    } else if (t.type === "multi_conditional_summary") {
      const rng = (c: string) => `${col(c)}2:${col(c)}${n + 1}`;
      const crit = t.criteria.map((c) => `${rng(c.column)},"${c.value}"`).join(",");
      cells[target.cells[0]] = t.fn === "COUNTIFS" ? `=COUNTIFS(${crit})` : `=ROUND(${t.fn}(${rng(t.column)},${crit}),${t.decimals})`;
    } else {
      const crit = `${col(t.criteria_column)}2:${col(t.criteria_column)}${n + 1}`;
      const vals = `${col(t.column)}2:${col(t.column)}${n + 1}`;
      cells[target.cells[0]] = t.fn === "COUNTIF" ? `=COUNTIF(${crit},"${t.criteria_value}")` : `=ROUND(${t.fn}(${crit},"${t.criteria_value}",${vals}),${t.decimals})`;
    }
  });
  return cells;
}
