import type { SqlCell, SqlResult } from "./sql-runner";

export interface GradeFeedback {
  passed: boolean;
  message: string;
  expectedRows: number;
  actualRows: number | null;
  matchedValues: number;
  totalValues: number;
}

// Tight enough that a wrong filter (even one ₹169 order) fails, loose enough
// for rounding to 2 decimals / percentages to 1 decimal.
const ABS_TOLERANCE = 0.06;
const REL_TOLERANCE = 0.0002;

const numberClose = (a: number, b: number) => Math.abs(a - b) <= Math.max(ABS_TOLERANCE, Math.abs(b) * REL_TOLERANCE);
const normText = (v: string) => v.trim().toLowerCase();

function asNumber(cell: SqlCell): number | null {
  if (typeof cell === "number") return cell;
  if (typeof cell === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(cell)) return Number(cell);
  return null;
}

/**
 * Pure. Passes when the student's result has the same number of rows as the
 * ground truth and contains every value the ground truth contains (each
 * student value can satisfy only one expected value). Column names/order
 * don't matter — analysts name things differently. Expected values are
 * never returned, only counts.
 */
export function gradeSqlResult(expected: SqlResult, actual: SqlResult): GradeFeedback {
  if ("error" in expected) throw new Error(`Ground-truth query failed — content bug: ${expected.error}`);
  const expectedCells = expected.rows.flat().filter((c) => c !== null);
  const base = { expectedRows: expected.rows.length, totalValues: expectedCells.length };

  if ("error" in actual) {
    return { ...base, passed: false, actualRows: null, matchedValues: 0, message: `Your query failed: ${actual.error}` };
  }

  const pool = actual.rows.flat().filter((c) => c !== null);
  const used = new Set<number>();
  let matched = 0;
  for (const want of expectedCells) {
    const wantNum = asNumber(want);
    const idx = pool.findIndex((got, i) => {
      if (used.has(i)) return false;
      const gotNum = asNumber(got);
      if (wantNum !== null && gotNum !== null) return numberClose(gotNum, wantNum);
      return typeof want === "string" && typeof got === "string" && normText(got) === normText(want);
    });
    if (idx !== -1) {
      used.add(idx);
      matched++;
    }
  }

  const rowsOk = actual.rows.length === expected.rows.length;
  const passed = rowsOk && matched === expectedCells.length;
  const message = passed
    ? "Your numbers match. Ticket closed."
    : !rowsOk
      ? `Expected ${expected.rows.length} row${expected.rows.length === 1 ? "" : "s"}, your query returned ${actual.rows.length}. Re-read the deliverable.`
      : `Row count is right, but ${expectedCells.length - matched} of ${expectedCells.length} values don't match. Check your filters, joins and rounding.`;

  return { ...base, passed, actualRows: actual.rows.length, matchedValues: matched, message };
}
