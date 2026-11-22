import { adminDb, rowsOf, safe } from "./db";
import { groupGoalDemand, type GoalDemand, type GoalRequestRow } from "./goal-demand";

export type { GoalDemand } from "./goal-demand";

/** Every goal a student typed that no job role or published pathway covered, ranked by how many students asked. */
export async function listGoalDemand(): Promise<GoalDemand[]> {
  const rows = rowsOf<GoalRequestRow>(await safe(adminDb().from("goal_requests").select("goal_key, goal_text, user_id, status, created_at").neq("status", "DECLINED").limit(20000), { data: [] } as never, "goals"));
  return groupGoalDemand(rows);
}
