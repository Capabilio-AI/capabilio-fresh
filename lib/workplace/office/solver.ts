import { columnLetters } from "@/lib/arena-workstations/engines/formula";
import type { SheetLayout, SpreadsheetContent } from "@/lib/arena-workstations/engines/spreadsheet";

/** A perfect candidate: writes the correct Excel formula for every target cell of a sheet ticket. */
export function solveSheet(content: SpreadsheetContent, layout: SheetLayout): Record<string, string> {
  const { data, lookup, tasks } = content;
  const letter = (name: string) => columnLetters(data.columns.findIndex((c) => c.name === name));
  const n = data.rows.length;
  const lookupStart = data.columns.length + tasks.filter((t) => t.type === "row_formula" || t.type === "lookup").length + 1;
  const rangeOf = (name: string) => `${letter(name)}2:${letter(name)}${n + 1}`;
  const out: Record<string, string> = {};
  tasks.forEach((t, i) => {
    const cells = layout.targets.find((x) => x.task === i)!.cells;
    if (t.type === "row_formula") {
      cells.forEach((cell, r) => {
        const L = `${letter(t.left)}${r + 2}`;
        const R = `${letter(t.right)}${r + 2}`;
        const expr = { multiply: `${L}*${R}`, add: `${L}+${R}`, subtract: `${L}-${R}`, divide: `${L}/${R}`, percent_change: `(${R}-${L})/${L}*100`, percent_of: `${L}/${R}*100` }[t.op];
        out[cell] = `=ROUND(${expr},${t.decimals})`;
      });
    } else if (t.type === "lookup") {
      const table = `$${columnLetters(lookupStart)}$2:$${columnLetters(lookupStart + 1)}$${lookup!.rows.length + 1}`;
      cells.forEach((cell, r) => (out[cell] = `=VLOOKUP(${letter(t.key_column)}${r + 2},${table},2,FALSE)`));
    } else if (t.type === "summary") {
      out[cells[0]] = t.fn === "COUNT" ? `=COUNT(${rangeOf(t.column)})` : `=ROUND(${t.fn}(${rangeOf(t.column)}),${t.decimals})`;
    } else {
      const crit = rangeOf(t.criteria_column);
      const val = rangeOf(t.column);
      out[cells[0]] = t.fn === "COUNTIF" ? `=COUNTIF(${crit},"${t.criteria_value}")` : `=ROUND(${t.fn}(${crit},"${t.criteria_value}",${val}),${t.decimals})`;
    }
  });
  return out;
}
