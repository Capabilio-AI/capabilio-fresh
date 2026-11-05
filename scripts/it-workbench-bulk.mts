// Fills the shared IT bank (CSE / IT / AI&ML / DS) with SQL workbench tasks. Every task is validated first: its reference query must run and
// return 1-25 rows on the task's own data; the expected result is computed from it and kept server-side (arena_challenge_tests).
//   npm run it:workbench -- sql 5      (5 data seeds per dataset -> a few hundred tasks; safe to re-run, nothing is stored twice)
//   npm run it:workbench -- dba 6      (DBA script tasks: indexes, views, schema changes, constraints, triggers; add --dry to validate only)
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { IT_CLUSTER_SCOPE_KEY } from "@/lib/arena-challenges/branch-clusters";
import { WORLD_KEYS, buildWorld } from "@/lib/arena-challenges/workbench/sql-bank";
import { buildDba } from "@/lib/arena-challenges/workbench/dba-bank";
import { computeAnswer, computeScriptAnswer, publicTask } from "@/lib/arena-challenges/workbench/sql-task";

const [kind = "sql", seedsArg = "5"] = process.argv.slice(2);
if (kind !== "sql" && kind !== "dba") throw new Error("Usage: npm run it:workbench -- sql|dba <seeds>");
const dry = process.argv.includes("--dry");
const seeds = Number(seedsArg);
const service = createServiceClient();
const db = untyped(service);
const MINUTES = { easy: 8, medium: 12, hard: 15 } as const; // the shared clock (lib/arena-challenges/timer.ts)
const fingerprint = (title: string, expected: unknown) => createHash("sha1").update(`${title}|${JSON.stringify(expected)}`).digest("hex").slice(0, 24);

const { data: existing } = await db.from("arena_challenges").select("expected_output").eq("track", "stream").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("kind", "sql").limit(5000);
const have = new Set(((existing ?? []) as { expected_output: string }[]).map((r) => r.expected_output));
let added = 0, skipped = 0, rejected = 0;
if (kind === "dba") {
  const existingDba = new Set(have);
  for (let seed = 1; seed <= seeds; seed++) for (const t of buildDba(seed)) {
    const r = await computeScriptAnswer(t.tables, t.setupSql, t.script, t.probes);
    if ("reason" in r) { console.log(`REJECT ${t.title} #${seed}: ${r.reason}`); rejected++; continue; }
    const fp = fingerprint(t.title, [r.answer.expected, t.prompt, t.tables.map((x) => x.rows.length)]);
    if (existingDba.has(fp)) { skipped++; continue; }
    if (dry) { existingDba.add(fp); added++; continue; }
    const problem = { ...publicTask({ title: t.title, category: t.category, difficulty: t.difficulty, prompt: t.prompt, query: "", ordered: false, tables: t.tables, tags: t.tags }), mode: "script", previewQuery: t.previewQuery, setupSql: t.setupSql, starter: "-- write your statements here\n" };
    const { data, error } = await db.from("arena_challenges").insert({
      track: "stream", scope_key: IT_CLUSTER_SCOPE_KEY, user_id: null, kind: "sql", title: t.title, category: `DBA · ${t.category}`, difficulty: t.difficulty,
      scenario: t.prompt, objective: t.prompt, language: "sql", starter_code: null, stdin: null, expected_output: fp, answer_unit: null, options: null,
      explanation: null, problem, skill_tags: ["DBA", t.category, ...t.tags.slice(0, 1)], course_tags: ["DBMS"], branch_keys: [IT_CLUSTER_SCOPE_KEY],
      est_minutes: MINUTES[t.difficulty], active: true, status: "PUBLISHED", source: "CAPABILIO",
    }).select("id").single();
    if (error || !data) { console.error(`insert failed (${t.title}): ${error?.message}`); rejected++; continue; }
    const tests = await db.from("arena_challenge_tests").insert({ challenge_id: data.id, tests: [r.answer, { ordered: false }], sample_count: 1, reference_solution: t.script });
    if (tests.error) { await db.from("arena_challenges").delete().eq("id", data.id); console.error(`answer insert failed (${t.title}): ${tests.error.message}`); rejected++; continue; }
    existingDba.add(fp); added++;
  }
  console.log(JSON.stringify({ kind, dry, added, skipped, rejected }));
  process.exit(0);
}
for (const world of WORLD_KEYS) for (let seed = 1; seed <= seeds; seed++) for (const t of buildWorld(world, seed)) {
  const r = await computeAnswer(t);
  if ("reason" in r) { rejected++; continue; }
  const fp = fingerprint(t.title, r.answer.expected);
  if (have.has(fp)) { skipped++; continue; }
  const { data, error } = await db.from("arena_challenges").insert({
    track: "stream", scope_key: IT_CLUSTER_SCOPE_KEY, user_id: null, kind: "sql", title: t.title, category: `SQL · ${t.category}`, difficulty: t.difficulty,
    scenario: t.prompt, objective: t.prompt, language: "sql", starter_code: null, stdin: null, expected_output: fp, answer_unit: null, options: null,
    explanation: null, problem: publicTask(t), skill_tags: ["SQL", t.category, world], course_tags: ["DBMS"], branch_keys: [IT_CLUSTER_SCOPE_KEY],
    est_minutes: MINUTES[t.difficulty], active: true, status: "PUBLISHED", source: "CAPABILIO",
  }).select("id").single();
  if (error || !data) { console.error(`insert failed (${t.title}): ${error?.message}`); rejected++; continue; }
  const tests = await db.from("arena_challenge_tests").insert({ challenge_id: data.id, tests: [r.answer.expected, { ordered: t.ordered }], sample_count: 1, reference_solution: t.query });
  if (tests.error) { await db.from("arena_challenges").delete().eq("id", data.id); console.error(`answer insert failed (${t.title}): ${tests.error.message}`); rejected++; continue; }
  have.add(fp); added++;
}
console.log(JSON.stringify({ added, skipped, rejected }));
