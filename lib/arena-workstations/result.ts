/** How a closed ticket ended, read from its stored grade. A ticket that timed out or was answered wrongly is "failed"; one still open has no result. */
export type TicketResult = "passed" | "failed";

export function resultOf(grade: unknown): TicketResult | null {
  const passed = grade && typeof grade === "object" ? (grade as { passed?: unknown }).passed : undefined;
  return passed === true ? "passed" : passed === false ? "failed" : null;
}

interface GradedRow {
  skill_area_key: string | null;
  grade: unknown;
  assigned_at: string;
}

/**
 * The newest graded ticket decides each area's colour: green after a pass, red after a miss, and a later ticket replaces an earlier one. A ticket counts
 * as soon as it is graded, so one that is solved and only waiting for its interview already shows green.
 */
export function latestResultByArea(rows: readonly GradedRow[]): Map<string, TicketResult> {
  const newest = new Map<string, { at: number; result: TicketResult }>();
  for (const r of rows) {
    const result = resultOf(r.grade);
    if (!r.skill_area_key || !result) continue;
    const at = Date.parse(r.assigned_at);
    if ((newest.get(r.skill_area_key)?.at ?? -Infinity) < at) newest.set(r.skill_area_key, { at, result });
  }
  return new Map([...newest].map(([k, v]) => [k, v.result]));
}
