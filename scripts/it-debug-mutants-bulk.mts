// Many more fix-the-bug tasks, made by changing ONE thing in a verified program (see lib/arena-challenges/workbench/mutate.ts). A mutant is kept only
// if it builds, fails at least one test and runs on at least one, and behaves differently from the mutants already kept for that program.
//   npm run it:debug-mutants -- python 9 --dry       (language, max mutants per program, validate only)
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { IT_CLUSTER_SCOPE_KEY } from "@/lib/arena-challenges/branch-clusters";
import { DEBUG_PROGRAMS } from "@/lib/arena-challenges/workbench/debug-bank";
import { LANG_PROGRAMS } from "@/lib/arena-challenges/workbench/debug-bank-langs";
import { mutants, type MutantLang } from "@/lib/arena-challenges/workbench/mutate";
import { runLocal } from "@/lib/arena-challenges/workbench/local-run";
import { hashSeed } from "@/lib/workplace/rng";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const lang = (args[0] ?? "python") as MutantLang;
const perProgram = Number(args[1] ?? 9);
const dry = process.argv.includes("--dry");
const LABEL: Record<MutantLang, string> = { python: "Python", javascript: "JavaScript", cpp: "C++", c: "C" };
const MINUTES = { easy: 8, medium: 12, hard: 15 } as const; // the shared clock (lib/arena-challenges/timer.ts)

const service = createServiceClient();
const db = untyped(service);
const { data: existing } = await db.from("arena_challenges").select("title, starter_code").eq("track", "stream").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("kind", "leetcode").eq("source", "CAPABILIO").limit(8000);
const have = new Set(((existing ?? []) as { title: string; starter_code: string }[]).map((r) => `${r.title}|${r.starter_code}`));

const programs = lang === "python"
  ? DEBUG_PROGRAMS.map((p) => ({ prog: p, code: p.code }))
  : LANG_PROGRAMS.filter((l) => l.lang === lang).map((l) => ({ prog: DEBUG_PROGRAMS.find((d) => d.title === l.ref)!, code: l.code }));

let added = 0, skipped = 0, noBug = 0;
for (const { prog, code } of programs) {
  const expected = runLocal("python", prog.code, prog.inputs);
  if (expected.some((o) => o.startsWith("ERR"))) { console.log(`SKIP ${prog.title}: python reference fails`); continue; }
  if (runLocal(lang, code, prog.inputs).some((o, i) => o !== expected[i])) { console.log(`SKIP ${prog.title} [${lang}]: correct program disagrees with the reference`); continue; }
  const kept: { code: string; note: string; kind: string; sig: string }[] = [];
  const sigs = new Set<string>();
  for (const m of mutants(code, lang)) {
    const got = runLocal(lang, m.code, prog.inputs);
    if (got.some((o) => o.startsWith("ERR:compile"))) continue;
    const failing = got.filter((o, i) => o !== expected[i]).length;
    if (failing === 0) continue; // behaves like the original: not a bug
    if (got.every((o) => o.startsWith("ERR"))) continue; // does not even run on any test: too broken to be a good puzzle
    const sig = got.join("|");
    if (sigs.has(sig)) continue;
    sigs.add(sig);
    kept.push({ ...m, sig });
  }
  // spread over kinds of bug, then a stable shuffle, so a program's variants are not all the same kind
  const byKind = new Map<string, typeof kept>();
  for (const k of kept) byKind.set(k.kind, [...(byKind.get(k.kind) ?? []), k].sort((a, b) => hashSeed(a.code) - hashSeed(b.code)));
  const picked: typeof kept = [];
  for (let round = 0; picked.length < perProgram; round++) {
    let any = false;
    for (const list of byKind.values()) if (list[round] && picked.length < perProgram) { picked.push(list[round]); any = true; }
    if (!any) break;
  }
  if (picked.length === 0) noBug++;
  let n = 0;
  for (const m of picked) {
    n++;
    const title = `Fix the bug: ${prog.title} (${LABEL[lang]}) · variant ${n}`;
    if (have.has(`${title}|${m.code}`)) { skipped++; continue; }
    if (dry) { added++; continue; }
    const problem = {
      statement: `The ${LABEL[lang]} program below is meant to solve this task, but it has a bug. Find it and fix it so every test passes.\n\n${prog.statement}`,
      inputFormat: prog.inputFormat, outputFormat: prog.outputFormat, constraints: prog.constraints, debug: true, ...(lang === "python" ? {} : { debugLang: lang, debugStarter: m.code }),
      examples: prog.inputs.slice(0, 2).map((input, i) => ({ input: input.trimEnd(), output: expected[i], explanation: "What a correct program prints for this input." })),
      starters: { python: lang === "python" ? m.code : "", c: "" },
    };
    const { data, error } = await db.from("arena_challenges").insert({
      track: "stream", scope_key: IT_CLUSTER_SCOPE_KEY, user_id: null, kind: "leetcode", title, category: `Debugging · ${prog.topic}`, difficulty: prog.difficulty,
      scenario: prog.statement.slice(0, 400), objective: prog.outputFormat, language: lang, starter_code: m.code, stdin: prog.inputs[0], expected_output: expected[0],
      skill_tags: ["Debugging", LABEL[lang], prog.topic], course_tags: ["Programming", "Data Structures"], branch_keys: [IT_CLUSTER_SCOPE_KEY], est_minutes: MINUTES[prog.difficulty],
      active: true, status: "PUBLISHED", source: "CAPABILIO", week_start: null, problem,
    }).select("id").single();
    if (error || !data) { console.error(`insert failed (${title}): ${error?.message}`); continue; }
    const tests = await db.from("arena_challenge_tests").insert({ challenge_id: data.id, tests: prog.inputs.map((input, i) => ({ input, output: expected[i] })), sample_count: 2, reference_solution: code });
    if (tests.error) { await db.from("arena_challenges").delete().eq("id", data.id); console.error(`tests insert failed (${title}): ${tests.error.message}`); continue; }
    added++;
  }
  console.log(`${prog.title} [${lang}]: ${kept.length} usable mutants, ${picked.length} kept`);
}
console.log(JSON.stringify({ lang, dry, added, skipped, programsWithoutUsableBug: noBug }));
