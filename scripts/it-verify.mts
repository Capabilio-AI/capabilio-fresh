import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { loadStreamPool } from "@/lib/arena-challenges/stream-context";
import { IT_CLUSTER_SCOPE_KEY } from "@/lib/arena-challenges/branch-clusters";
import { IT_KIND_CAPS, selectStreamBatch } from "@/lib/arena-challenges/select-stream";
import { runStudentQuery, compareResult } from "@/lib/arena-challenges/workbench/sql-task";
import type { SqlAnswer, PublicSqlTask } from "@/lib/arena-challenges/workbench/sql-task";

const service = createServiceClient();
const pool = await loadStreamPool(service, { scopeKey: IT_CLUSTER_SCOPE_KEY, branchKey: IT_CLUSTER_SCOPE_KEY, promptLabel: "Computer Science / IT / AI & Data Science" });
const count: Record<string, number> = {};
for (const c of pool) count[c.kind ?? "?"] = (count[c.kind ?? "?"] ?? 0) + 1;
console.log("IT pool", pool.length, count);
for (const size of [4, 6, 9]) for (const year of [2, 3]) {
  const kinds: Record<string, number> = {};
  for (let u = 0; u < 20; u++) {
    const sel = selectStreamBatch({ pool, solvedIds: new Set(), recentIds: new Set(), courses: [], currentYear: year, year, points: 100, seed: `user${u}:w`, size, kindCaps: IT_KIND_CAPS(size) });
    for (const id of sel.ids) { const k = pool.find((c) => c.id === id)!.kind!; kinds[k] = (kinds[k] ?? 0) + 1; }
  }
  console.log(`size ${size} year ${year} (20 students):`, kinds);
}
// grade a stored SQL task: its reference query must pass, a wrong query must not
const db = untyped(service);
const { data: rows } = await db.from("arena_challenges").select("id, title, problem").eq("kind", "sql").eq("scope_key", IT_CLUSTER_SCOPE_KEY).is("problem->>mode", null).limit(60);
let pass = 0, wrongRejected = 0, n = 0;
for (const r of rows as { id: string; title: string; problem: PublicSqlTask }[]) {
  const { data: t } = await db.from("arena_challenge_tests").select("tests, reference_solution").eq("challenge_id", r.id).single();
  const answer: SqlAnswer = { expected: t!.tests[0] };
  const ok = compareResult(answer, await runStudentQuery(r.problem.tables, t!.reference_solution), r.problem.ordered);
  const wrong = compareResult(answer, await runStudentQuery(r.problem.tables, `SELECT 1`), r.problem.ordered);
  n++; if (ok.passed) pass++; if (!wrong.passed) wrongRejected++;
}
console.log(`SQL grading on ${n} stored tasks: reference accepted ${pass}, wrong query rejected ${wrongRejected}`);
