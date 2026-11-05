// Fix-the-bug tasks in JavaScript, C++, C and Java (ports of the Python tasks). A task is stored only if the correct program passes every test
// (its expected output comes from the verified Python version) and the buggy one fails at least one. The programs are ours, so compiling and
// running them here is safe; C, C++ and JavaScript run on this machine, Java goes through the public runner (no JDK here), one request at a time.
//   npm run it:debug-langs -- --dry            (validate only)     npm run it:debug-langs -- java        (only one language)
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { IT_CLUSTER_SCOPE_KEY } from "@/lib/arena-challenges/branch-clusters";
import { DEBUG_PROGRAMS } from "@/lib/arena-challenges/workbench/debug-bank";
import { LANG_PROGRAMS, type DebugLang } from "@/lib/arena-challenges/workbench/debug-bank-langs";
import { normalizeOutput } from "@/lib/arena-challenges/leetcode/judge";
import { runCode } from "@/lib/code-execution/wandbox";

const dry = process.argv.includes("--dry");
const only = process.argv.slice(2).find((a) => !a.startsWith("--")) as DebugLang | undefined;
const dir = mkdtempSync(path.join(tmpdir(), "debug-langs-"));
const MINUTES = { easy: 8, medium: 12, hard: 15 } as const; // the shared clock (lib/arena-challenges/timer.ts)
const LABEL: Record<DebugLang, string> = { javascript: "JavaScript", cpp: "C++", c: "C", java: "Java" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function local(cmd: string, args: string[], input?: string) {
  return spawnSync(cmd, args, { input, encoding: "utf8", timeout: 5000 });
}
function pyExpected(code: string, input: string): string {
  const f = path.join(dir, "ref.py");
  writeFileSync(f, code);
  const r = local("python3", ["-I", f], input);
  return r.status === 0 ? normalizeOutput(r.stdout) : "ERR";
}

/** Runs one program on every input; returns one output per input ("ERR:..." when it fails to build or run). */
async function runAll(lang: DebugLang, code: string, inputs: string[]): Promise<string[]> {
  if (lang === "java") {
    const out: string[] = [];
    for (const input of inputs) {
      let res = "ERR:runner";
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const r = await runCode("java", code, input);
          res = r.compileError ? `ERR:compile ${r.compileError.slice(0, 120)}` : r.stderr && !r.stdout ? `ERR:${r.stderr.slice(0, 80)}` : normalizeOutput(r.stdout);
          break;
        } catch { await sleep(2500 * (attempt + 1)); }
      }
      out.push(res);
      await sleep(900);
    }
    return out;
  }
  if (lang === "javascript") {
    const f = path.join(dir, "p.js");
    writeFileSync(f, code);
    return inputs.map((i) => { const r = local("node", [f], i); return r.status === 0 ? normalizeOutput(r.stdout) : `ERR:${r.status}`; });
  }
  const src = path.join(dir, lang === "c" ? "p.c" : "p.cpp");
  const bin = path.join(dir, "p.bin");
  // the judge runs GCC, where <bits/stdc++.h> exists; this machine has clang, so only here the umbrella header is spelled out
  writeFileSync(src, code.replace("#include <bits/stdc++.h>", "#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <cmath>\n#include <string>"));
  const c = lang === "c" ? local("gcc", ["-O1", "-o", bin, src]) : local("g++", ["-O1", "-std=c++17", "-o", bin, src]);
  if (c.status !== 0) return inputs.map(() => `ERR:compile ${(c.stderr ?? "").slice(0, 120)}`);
  return inputs.map((i) => { const r = local(bin, [], i); return r.status === 0 ? normalizeOutput(r.stdout) : `ERR:${r.status}`; });
}

const service = createServiceClient();
const db = untyped(service);
const { data: existing } = await db.from("arena_challenges").select("title, starter_code").eq("track", "stream").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("kind", "leetcode").eq("source", "CAPABILIO").limit(5000);
const have = new Set(((existing ?? []) as { title: string; starter_code: string }[]).map((r) => `${r.title}|${r.starter_code}`));
let added = 0, skipped = 0, rejected = 0;
for (const lp of LANG_PROGRAMS) {
  if (only && lp.lang !== only) continue;
  const prog = DEBUG_PROGRAMS.find((p) => p.title === lp.ref);
  if (!prog) { console.log(`REJECT ${lp.ref}: no Python task of that name`); rejected++; continue; }
  const tag = `${lp.ref} [${LABEL[lp.lang]}]`;
  const expected = prog.inputs.map((i) => pyExpected(prog.code, i));
  if (expected.some((o) => o === "ERR" || o === "")) { console.log(`REJECT ${tag}: the Python reference fails`); rejected++; continue; }
  const good = await runAll(lp.lang, lp.code, prog.inputs);
  const wrong = good.map((o, i) => o !== expected[i] ? i : -1).filter((i) => i >= 0);
  if (wrong.length) { console.log(`REJECT ${tag}: the correct program is wrong on test ${wrong.map((i) => i + 1).join(",")} (${good[wrong[0]].slice(0, 60)} vs ${expected[wrong[0]]})`); rejected++; continue; }
  for (const bug of lp.bugs) {
    if (!lp.code.includes(bug.find)) { console.log(`REJECT ${tag}: bug text not found (${bug.note})`); rejected++; continue; }
    const buggy = lp.code.replace(bug.find, bug.replace);
    const title = `Fix the bug: ${lp.ref} (${LABEL[lp.lang]})`;
    if (have.has(`${title}|${buggy}`)) { skipped++; continue; }
    const got = await runAll(lp.lang, buggy, prog.inputs);
    const failing = got.filter((o, i) => o !== expected[i]).length;
    if (failing === 0) { console.log(`REJECT ${tag}: the bug "${bug.note}" changes no output`); rejected++; continue; }
    if (dry) { added++; continue; }
    const problem = {
      statement: `The ${LABEL[lp.lang]} program below is meant to solve this task, but it has a bug. Find it and fix it so every test passes.\n\n${prog.statement}`,
      inputFormat: prog.inputFormat, outputFormat: prog.outputFormat, constraints: prog.constraints, debug: true, debugLang: lp.lang, debugStarter: buggy,
      examples: prog.inputs.slice(0, 2).map((input, i) => ({ input: input.trimEnd(), output: expected[i], explanation: "What a correct program prints for this input." })),
      starters: { python: "", c: "" },
    };
    const { data, error } = await db.from("arena_challenges").insert({
      track: "stream", scope_key: IT_CLUSTER_SCOPE_KEY, user_id: null, kind: "leetcode", title, category: `Debugging · ${prog.topic}`, difficulty: prog.difficulty,
      scenario: prog.statement.slice(0, 400), objective: prog.outputFormat, language: lp.lang, starter_code: buggy, stdin: prog.inputs[0], expected_output: expected[0],
      skill_tags: ["Debugging", LABEL[lp.lang], prog.topic], course_tags: ["Programming", "Data Structures"], branch_keys: [IT_CLUSTER_SCOPE_KEY], est_minutes: MINUTES[prog.difficulty],
      active: true, status: "PUBLISHED", source: "CAPABILIO", week_start: null, problem,
    }).select("id").single();
    if (error || !data) { console.error(`insert failed (${title}): ${error?.message}`); rejected++; continue; }
    const tests = await db.from("arena_challenge_tests").insert({ challenge_id: data.id, tests: prog.inputs.map((input, i) => ({ input, output: expected[i] })), sample_count: 2, reference_solution: lp.code });
    if (tests.error) { await db.from("arena_challenges").delete().eq("id", data.id); console.error(`tests insert failed (${title}): ${tests.error.message}`); rejected++; continue; }
    added++;
  }
  console.log(`done ${tag}`);
}
console.log(JSON.stringify({ dry, added, skipped, rejected }));
