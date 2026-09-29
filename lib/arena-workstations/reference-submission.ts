import { columnLetters } from "./engines/formula";
import type { SpreadsheetPublicContent } from "./tools/spreadsheet";

// TEST SUPPORT ONLY (*.live.test.ts): builds the correct submission for a
// generated instance from its server-side answer key, to drive end-to-end
// tests through the real grader. Never imported by app code.
export function referenceSubmission(toolType: string, content: unknown, answerKey: unknown): unknown {
  const key = answerKey as Record<string, unknown>;
  switch (toolType) {
    case "sql_workspace":
      return { query: key.reference_query };
    case "statistics_workspace":
      return { answers: Object.fromEntries((key.expected as { key: string; value: number | string }[]).map((e) => [e.key, typeof e.value === "number" ? e.value.toFixed(3) : e.value])) };
    case "cleaning_workspace":
      return { steps: key.steps };
    case "dashboard_workspace":
      return { spec: key.spec };
    case "spreadsheet_workspace":
      return { cells: referenceFormulas(content as SpreadsheetPublicContent) };
    default:
      throw new Error(`no reference submission for ${toolType}`);
  }
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
    } else {
      const crit = `${col(t.criteria_column)}2:${col(t.criteria_column)}${n + 1}`;
      const vals = `${col(t.column)}2:${col(t.column)}${n + 1}`;
      cells[target.cells[0]] = t.fn === "COUNTIF" ? `=COUNTIF(${crit},"${t.criteria_value}")` : `=ROUND(${t.fn}(${crit},"${t.criteria_value}",${vals}),${t.decimals})`;
    }
  });
  return cells;
}
