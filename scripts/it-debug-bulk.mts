// Fix-the-bug tasks for the shared IT bank. Each is a correct Python program plus one deliberate bug; a task is stored only if the correct
// program passes every test and the buggy one fails at least one. The programs are ours (lib/arena-challenges/workbench/debug-bank.ts), so
// running them here is safe. Students' code never runs on this machine; it goes through the judge.
//   npm run it:debug            (validate and store)      npm run it:debug -- --dry      (validate only)
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { IT_CLUSTER_SCOPE_KEY } from "@/lib/arena-challenges/branch-clusters";
import { DEBUG_PROGRAMS } from "@/lib/arena-challenges/workbench/debug-bank";
import { normalizeOutput } from "@/lib/arena-challenges/leetcode/judge";

const dry = process.argv.includes("--dry");
const dir = mkdtempSync(path.join(tmpdir(), "debug-bank-"));
const MINUTES = { easy: 8, medium: 12, hard: 15 } as const; // the shared clock (lib/arena-challenges/timer.ts)

function run(code: string, input: string): string {
  const file = path.join(dir, "p.py");
  writeFileSync(file, code);
  const r = spawnSync("python3", ["-I", file], { input, encoding: "utf8", timeout: 3000 });
  return r.status === 0 ? normalizeOutput(r.stdout) : `ERR:${r.status ?? "timeout"}`;
}

const service = createServiceClient();
const db = untyped(service);
const { data: existing } = await db.from("arena_challenges").select("title, starter_code").eq("track", "stream").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("kind", "leetcode").eq("source", "CAPABILIO").limit(5000);
const have = new Set(((existing ?? []) as { title: string; starter_code: string }[]).map((r) => `${r.title}|${r.starter_code}`));
let added = 0, skipped = 0, rejected = 0;
for (const prog of DEBUG_PROGRAMS) {
  const expected = prog.inputs.map((i) => run(prog.code, i));
  if (expected.some((o) => o.startsWith("ERR:") || o === "")) { console.log(`REJECT ${prog.title}: the correct program fails on a test`); rejected++; continue; }
  for (const bug of prog.bugs) {
    if (!prog.code.includes(bug.find)) { console.log(`REJECT ${prog.title}: bug text not found (${bug.note})`); rejected++; continue; }
    const buggy = prog.code.replace(bug.find, bug.replace);
    const got = prog.inputs.map((i) => run(buggy, i));
    const failing = got.filter((o, i) => o !== expected[i]).length;
    if (failing === 0) { console.log(`REJECT ${prog.title}: the bug "${bug.note}" changes no output`); rejected++; continue; }
    if (failing === prog.inputs.length) { console.log(`NOTE   ${prog.title}: the bug fails every test (${bug.note})`); }
    const title = `Fix the bug: ${prog.title}`;
    if (have.has(`${title}|${buggy}`)) { skipped++; continue; }
    if (dry) { added++; continue; }
    const problem = {
      statement: `The program below is meant to solve this task, but it has a bug. Find it and fix it so every test passes.\n\n${prog.statement}`,
      inputFormat: prog.inputFormat, outputFormat: prog.outputFormat, constraints: prog.constraints, debug: true,
      examples: prog.inputs.slice(0, 2).map((input, i) => ({ input: input.trimEnd(), output: expected[i], explanation: "What a correct program prints for this input." })),
      starters: { python: buggy, c: "" },
    };
    const { data, error } = await db.from("arena_challenges").insert({
      track: "stream", scope_key: IT_CLUSTER_SCOPE_KEY, user_id: null, kind: "leetcode", title, category: `Debugging · ${prog.topic}`, difficulty: prog.difficulty,
      scenario: prog.statement.slice(0, 400), objective: prog.outputFormat, language: "python", starter_code: buggy, stdin: prog.inputs[0], expected_output: expected[0],
      skill_tags: ["Debugging", "Python", prog.topic], course_tags: ["Programming", "Data Structures"], branch_keys: [IT_CLUSTER_SCOPE_KEY], est_minutes: MINUTES[prog.difficulty],
      active: true, status: "PUBLISHED", source: "CAPABILIO", week_start: null, problem,
    }).select("id").single();
    if (error || !data) { console.error(`insert failed (${title}): ${error?.message}`); rejected++; continue; }
    const tests = await db.from("arena_challenge_tests").insert({ challenge_id: data.id, tests: prog.inputs.map((input, i) => ({ input, output: expected[i] })), sample_count: 2, reference_solution: prog.code });
    if (tests.error) { await db.from("arena_challenges").delete().eq("id", data.id); console.error(`tests insert failed (${title}): ${tests.error.message}`); rejected++; continue; }
    added++;
  }
}
console.log(JSON.stringify({ dry, added, skipped, rejected }));
