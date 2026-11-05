// LeetCode-style problems we wrote ourselves (lib/arena-challenges/workbench/leetcode-bank.ts). Each has two independent Python solutions; a problem is
// stored only if they agree on every small test, the main one runs on all tests, and the answers are not all the same.
//   npm run it:leetcode -- --dry
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { IT_CLUSTER_SCOPE_KEY } from "@/lib/arena-challenges/branch-clusters";
import { buildProblems } from "@/lib/arena-challenges/workbench/leetcode-bank";
import { normalizeOutput } from "@/lib/arena-challenges/leetcode/judge";

const dry = process.argv.includes("--dry");
const dir = mkdtempSync(path.join(tmpdir(), "leetcode-bank-"));
const MINUTES = { easy: 8, medium: 12, hard: 15 } as const; // the shared clock (lib/arena-challenges/timer.ts)
const PY_STARTER = "import sys\n\n\ndef main():\n    data = sys.stdin.read().split()\n    # TODO: read the input from `data`, then print the answer\n\n\nmain()\n";
const C_STARTER = "#include <stdio.h>\n\nint main() {\n    /* TODO: read the input with scanf, then print the answer with printf */\n    return 0;\n}\n";

function run(code: string, input: string): string {
  const f = path.join(dir, "p.py");
  writeFileSync(f, code);
  const r = spawnSync("python3", ["-I", f], { input, encoding: "utf8", timeout: 6000 });
  return r.status === 0 ? normalizeOutput(r.stdout) : `ERR:${r.status ?? "timeout"} ${(r.stderr ?? "").slice(-80)}`;
}

const service = createServiceClient();
const db = untyped(service);
const { data: existing } = await db.from("arena_challenges").select("title").eq("track", "stream").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("kind", "leetcode");
const have = new Set(((existing ?? []) as { title: string }[]).map((r) => r.title));
let added = 0, skipped = 0, rejected = 0;
for (const p of buildProblems()) {
  if (have.has(p.title)) { skipped++; continue; }
  const out = p.inputs.map((i) => run(p.ref, i));
  if (out.some((o) => o.startsWith("ERR") || o === "")) { console.log(`REJECT ${p.title}: the main solution fails (${out.find((o) => o.startsWith("ERR") || o === "")?.slice(0, 120)})`); rejected++; continue; }
  const alt = p.inputs.slice(0, 4).map((i) => run(p.alt, i));
  const bad = alt.findIndex((o, i) => o !== out[i]);
  if (bad !== -1) { console.log(`REJECT ${p.title}: the two solutions disagree on test ${bad + 1} (${out[bad].slice(0, 40)} vs ${alt[bad].slice(0, 40)})`); rejected++; continue; }
  if (new Set(out).size < 3) { console.log(`REJECT ${p.title}: the tests barely vary (${new Set(out).size} distinct answers)`); rejected++; continue; }
  if (dry) { added++; continue; }
  const problem = {
    statement: p.statement, inputFormat: p.inputFormat, outputFormat: p.outputFormat, constraints: p.constraints,
    examples: p.inputs.slice(0, 2).map((input, i) => ({ input: input.trimEnd(), output: out[i], explanation: p.explanations[i] })),
    starters: { python: PY_STARTER, c: C_STARTER },
  };
  const { data, error } = await db.from("arena_challenges").insert({
    track: "stream", scope_key: IT_CLUSTER_SCOPE_KEY, user_id: null, kind: "leetcode", title: p.title, category: p.topic, difficulty: p.difficulty,
    scenario: p.statement.slice(0, 400), objective: p.outputFormat, language: "python", starter_code: PY_STARTER, stdin: p.inputs[0], expected_output: out[0],
    skill_tags: [p.topic, "Problem solving"], course_tags: ["Data Structures", "Algorithms"], branch_keys: [IT_CLUSTER_SCOPE_KEY], est_minutes: MINUTES[p.difficulty],
    active: true, status: "PUBLISHED", source: "CAPABILIO", week_start: null, problem,
  }).select("id").single();
  if (error || !data) { console.error(`insert failed (${p.title}): ${error?.message}`); rejected++; continue; }
  const tests = await db.from("arena_challenge_tests").insert({ challenge_id: data.id, tests: p.inputs.map((input, i) => ({ input, output: out[i] })), sample_count: 2, reference_solution: p.ref });
  if (tests.error) { await db.from("arena_challenges").delete().eq("id", data.id); console.error(`tests insert failed (${p.title}): ${tests.error.message}`); rejected++; continue; }
  have.add(p.title); added++;
}
console.log(JSON.stringify({ dry, added, skipped, rejected }));
