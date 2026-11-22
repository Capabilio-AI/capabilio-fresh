export interface GoalRequestRow { goal_key: string; goal_text: string; user_id: string; status: string; created_at: string }
export interface GoalDemand {
  key: string;
  /** the wording typed most often for this goal (the first one seen when tied) */
  text: string;
  students: number;
  firstAsked: string;
  lastAsked: string;
  /** the other wordings people used, so a reviewer can see what the goal really covers */
  wordings: string[];
  covered: boolean;
}

/** Pure. Open goal requests grouped by their wording-independent key: how many different students asked, most-asked first, then the most recent. */
export function groupGoalDemand(rows: readonly GoalRequestRow[]): GoalDemand[] {
  const by = new Map<string, GoalRequestRow[]>();
  for (const r of rows) by.set(r.goal_key, [...(by.get(r.goal_key) ?? []), r]);
  return [...by.entries()]
    .map(([key, rs]) => {
      const counts = new Map<string, number>();
      for (const r of rs) counts.set(r.goal_text.trim(), (counts.get(r.goal_text.trim()) ?? 0) + 1);
      const wordings = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
      const dates = rs.map((r) => r.created_at).sort();
      return {
        key, text: wordings[0], students: new Set(rs.map((r) => r.user_id)).size, firstAsked: dates[0], lastAsked: dates[dates.length - 1],
        wordings: wordings.slice(1, 6), covered: rs.every((r) => r.status === "COVERED"),
      };
    })
    .sort((a, b) => b.students - a.students || b.lastAsked.localeCompare(a.lastAsked) || a.key.localeCompare(b.key));
}
