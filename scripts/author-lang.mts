// One authoring pipeline for every language track. The model DRAFTS; the real runner PROVES. Nothing the model claims about output is trusted: examples are run, the
// output shown in a lesson is the runner's, a module problem's expected outputs come from running its reference, and wrong options are checked to differ.
//   npm run author -- lessons    <track> <moduleKey|all>   draft lessons + the module problem, write lib/languages/<track>/<file>.ts and generated/<module>.json
//   npm run author -- questions  <track> <moduleKey|all>   draft code-reading snippets, keep only those the runner proves usable
//   npm run author -- analogies  <track>                   one everyday analogy per new lesson
//   npm run author -- index      <track>                   collect generated/*.json into challenges-extra.ts (and native-extra.ts when the track has native solutions)
// Set LLM_MODEL=claude-sonnet-5-5. Tracks: c, python.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { generateStructured as generate, type StructuredRequest } from "@/lib/ai/llm";

// The Groq fallback has no credit, and when the main route fails it would hide the real error behind its own. Authoring uses the main route only.
const NO_FALLBACK = { ...process.env, LLM_FALLBACK_PROVIDER: "", LLM_FALLBACK_MODEL: "", GROQ_FALLBACK_MODEL: "", LLM_FALLBACK2_PROVIDER: "", LLM_FALLBACK2_MODEL: "" };
const generateStructured = <T,>(req: StructuredRequest<T>) => generate(req, { env: NO_FALLBACK, repairs: 3 });
import { runCode } from "@/lib/code-execution/wandbox";
import type { LessonSpec, ModuleSpec } from "./authoring/c-modules";
import type { Language, Spec } from "./gen-code-questions.mts";

interface Cfg {
  track: string; runner: string; dir: string; ext: string;
  modules: () => Promise<ModuleSpec[]>;
  style: string; questionRules: string;
  /** null when fine, else a message the model is shown. Runs the example on this machine under the same flags the CI test uses. */
  localCheck: (code: string, file: string) => { error: string | null; stdout: string };
  /** require the runner's output to equal this machine's (catches nondeterminism and version differences) */
  compareWithLocal: boolean;
  nativeSolution: boolean;
  analogyFile: string; analogyExport: string; questionsExtra: string; questionsModule: string;
}

const SHARED = `You write lessons for first-generation college students in India (tier-2 and tier-3 colleges) who have English as a second language and little patience for theory. Rules:
- Short sentences, at most 20 words. Plain words. Explain a new term the first time it appears. No idioms.
- Teach with small programs. Every program is COMPLETE, reads NO input, prints something, and is deterministic (no randomness without a fixed seed, no current date or time, no set of strings printed in set order, no id() or hash()).
- Never put the program's output in your text: it is added by running the program.
- Be correct above all. Mention a real limit or trap where one exists.
- Each lesson: 2 or 3 sections, each with 2 short paragraphs and exactly one example. 3 takeaways. 3 common mistakes. 4 check questions.
- Check questions test understanding, not memory: at least two ask what a small program prints or why a bug happens. "wrong" answers must be plausible mistakes a student really makes, and all four options must be different.`;

const hashOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const tmp = () => mkdtempSync(join(tmpdir(), "author-"));

const CONFIGS: Record<string, Cfg> = {
  c: {
    track: "c", runner: "c", dir: "lib/languages/c", ext: "c", modules: async () => (await import("./authoring/c-modules")).C_MODULES,
    style: `${SHARED}\n- Each program is at most 35 lines. It compiles with gcc -std=c11 -Wall -Wextra with no warnings (no signed/unsigned comparisons, no unused variables) and without -lm.`,
    questionRules: `"body" = the statements inside main (no main, no #include: stdio.h, string.h and stdlib.h are already included, math.h and ctype.h are NOT), optional "top" = declarations before main (functions, structs, macros). No undefined behaviour, no uninitialised variables.`,
    localCheck: (code, file) => {
      writeFileSync(`${file}.c`, code);
      const cc = spawnSync("gcc", ["-Wall", "-Wextra", "-std=c11", "-o", file, `${file}.c`], { encoding: "utf8" });
      if (cc.stderr.trim()) return { error: `gives compiler warnings or errors with gcc -Wall -Wextra -std=c11: ${cc.stderr.slice(0, 400)}`, stdout: "" };
      return { error: null, stdout: "" };
    },
    compareWithLocal: false, nativeSolution: true,
    analogyFile: "lib/languages/analogies-extra.ts", analogyExport: "EXTRA_ANALOGIES", questionsExtra: "scripts/code-questions/c-extra.ts", questionsModule: "./code-questions/c.mts",
  },
  python: {
    track: "python", runner: "python", dir: "lib/languages/python", ext: "py", modules: async () => (await import("./authoring/python-modules")).PYTHON_MODULES,
    style: `${SHARED}\n- Each program is at most 30 lines, uses only the standard library, and runs on Python 3.8 (no match statements, no "X | Y" type hints, no str.removeprefix, no dict "|" merge). It must run cleanly with python3 -W error.`,
    questionRules: `"body" = the WHOLE program (put any def or class inside the body first). No input(), no imports of third-party packages, no randomness, no set of strings printed in set order, no id() or hash(). It must run on Python 3.8.`,
    localCheck: (code, file) => {
      writeFileSync(`${file}.py`, code);
      const run = spawnSync("python3", ["-I", "-W", "error", `${file}.py`], { input: "", encoding: "utf8", timeout: 15_000 });
      if (run.status !== 0) return { error: `fails with python3 -W error: ${(run.stderr || "").slice(-400)}`, stdout: "" };
      return { error: null, stdout: run.stdout };
    },
    compareWithLocal: true, nativeSolution: false,
    analogyFile: "lib/languages/analogies-extra-python.ts", analogyExport: "EXTRA_ANALOGIES_PYTHON", questionsExtra: "scripts/code-questions/python-extra.ts", questionsModule: "./code-questions/python.mts",
  },
};

// ------------------------------------------------------------------------------------------------ lessons
const Lesson = z.object({
  summary: z.string().min(40).max(320),
  sections: z.array(z.object({ heading: z.string().min(3).max(70), paragraphs: z.array(z.string().min(30).max(520)).length(2), example: z.object({ title: z.string().min(3).max(70), code: z.string().min(30).max(880), explanation: z.string().min(30).max(420) }) })).min(2).max(3),
  takeaways: z.array(z.string().min(10).max(160)).length(3),
  mistakes: z.array(z.string().min(10).max(200)).length(3),
  check: z.array(z.object({ question: z.string().min(12).max(300), right: z.string().min(1).max(120), wrong: z.array(z.string().min(1).max(120)).length(3), why: z.string().min(20).max(320) })).length(4),
});
type DraftLesson = z.infer<typeof Lesson>;

async function proveExamples(cfg: Cfg, d: DraftLesson): Promise<string | null> {
  for (const s of d.sections) {
    const label = `Example "${s.example.title}"`;
    const local = cfg.localCheck(s.example.code, join(tmp(), "a"));
    if (local.error) return `${label} ${local.error}`;
    const r = await runCode(cfg.runner, s.example.code, "");
    if (r.compileError.trim()) return `${label} did not compile on the runner: ${r.compileError.slice(0, 400)}`;
    if (r.stderr.trim()) return `${label} failed at run time on the runner: ${r.stderr.slice(0, 300)}`;
    const out = r.stdout.replace(/\r\n/g, "\n").trimEnd();
    if (!out) return `${label} printed nothing.`;
    if (cfg.compareWithLocal && out !== local.stdout.replace(/\r\n/g, "\n").trimEnd()) return `${label} prints different output on two runs or two Python versions (not deterministic?). Runner printed ${JSON.stringify(out.slice(0, 120))}.`;
    (s.example as { out?: string }).out = out;
  }
  if (new Set(d.check.map((c) => c.question)).size !== d.check.length) return "Two check questions are the same.";
  for (const c of d.check) if (new Set([c.right, ...c.wrong]).size !== 4) return `A check question has repeated options: ${c.question}`;
  return null;
}

async function draftLesson(cfg: Cfg, m: ModuleSpec, spec: LessonSpec): Promise<DraftLesson> {
  let feedback = "";
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { value } = await generateStructured({ task: "general", promptVersion: "author-lang-1", schema: Lesson, temperature: 0.4, maxTokens: 6000, system: cfg.style,
      user: `Write the ${cfg.track} lesson "${spec.title}" for the module "${m.title}". It must teach: ${spec.brief}${feedback ? `\n\nYour last draft was rejected: ${feedback}\nFix exactly that.` : ""}` });
    const problem = await proveExamples(cfg, value);
    if (!problem) return value;
    console.log(`  retry ${spec.key} (${attempt}): ${problem.slice(0, 160)}`);
    feedback = problem;
  }
  throw new Error(`could not draft ${spec.key}`);
}

const q = (s: string) => JSON.stringify(s);
function lessonSource(spec: LessonSpec, d: DraftLesson): string {
  const sections = d.sections.map((s) => {
    const out = (s.example as { out?: string }).out ?? "";
    return `        sec(${q(s.heading)}, [${s.paragraphs.map(q).join(", ")}], { title: ${q(s.example.title)}, code: ${q(s.example.code.trimEnd() + "\n")}, explanation: ${q(`${s.example.explanation.trim()} Output: ${out.replace(/\n/g, " / ")}`)} }),`;
  }).join("\n");
  const checks = d.check.map((c, i) => {
    const at = hashOf(`${spec.key}:${i}`) % 4; const options = [...c.wrong]; options.splice(at, 0, c.right);
    return `        q(${q(c.question)}, [${options.map(q).join(", ")}], ${at}, ${q(c.why)}),`;
  }).join("\n");
  return `    lesson(${q(spec.key)}, ${q(spec.title)}, ${spec.minutes}, {\n      summary: ${q(d.summary)},\n      sections: [\n${sections}\n      ],\n      takeaways: [${d.takeaways.map(q).join(", ")}],\n      mistakes: [${d.mistakes.map(q).join(", ")}],\n      check: [\n${checks}\n      ],\n    }),`;
}

const Challenge = z.object({
  title: z.string().min(3).max(60), statement: z.string().min(60).max(700), inputFormat: z.string().min(5).max(250), outputFormat: z.string().min(5).max(250),
  constraints: z.array(z.string().min(3).max(100)).min(1).max(4),
  inputs: z.array(z.string().min(1).max(400)).min(7).max(9), explanations: z.array(z.string().min(15).max(220)).length(2),
  referencePython: z.string().min(20).max(1500), solution: z.string().max(3000).optional(),
});

async function draftChallenge(cfg: Cfg, m: ModuleSpec) {
  let feedback = "";
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { value: c } = await generateStructured({ task: "general", promptVersion: "author-lang-challenge-1", schema: Challenge, temperature: 0.3, maxTokens: 4000,
      system: `${cfg.style}\nYou now write ONE programming problem that proves a module. Standard input to standard output. Give 7 to 9 inputs: the first two are shown as examples, the rest are hidden and must include edge cases (smallest, largest, a trap). Write an independent Python 3 reference (reads stdin, prints stdout, runs on Python 3.8).${cfg.nativeSolution ? ` Also write "solution": a solution in ${cfg.track}.` : ` Leave "solution" out.`} Inputs must be valid for the constraints.`,
      user: `Module "${m.title}". The problem: ${m.challengeBrief}${feedback ? `\n\nYour last draft was rejected: ${feedback}\nFix exactly that.` : ""}` });
    try {
      if (cfg.nativeSolution && !c.solution) throw new Error("the solution is missing");
      const tests: { input: string; output: string }[] = [];
      for (const raw of c.inputs) {
        const input = raw.endsWith("\n") ? raw : raw + "\n";
        const output = execFileSync("python3", ["-I", "-W", "error", "-c", c.referencePython], { input, encoding: "utf8", timeout: 10_000 });
        if (!output.trim()) throw new Error("the Python reference printed nothing for an input");
        tests.push({ input, output });
      }
      for (const t of tests) {
        // the reference itself must give the same answer on the runner a student uses; a native solution too when the track has one
        const check = async (label: string, code: string) => {
          const r = await runCode(cfg.runner, code, t.input);
          if (r.compileError.trim()) throw new Error(`the ${label} did not compile: ${r.compileError.slice(0, 300)}`);
          if (r.stdout.replace(/\r\n/g, "\n").trimEnd() !== t.output.trimEnd()) throw new Error(`the ${label} and the expected output disagree on input ${JSON.stringify(t.input)}: runner printed ${JSON.stringify(r.stdout.slice(0, 120))}, expected ${JSON.stringify(t.output.slice(0, 120))}`);
        };
        if (cfg.nativeSolution) await check(`${cfg.track} solution`, c.solution!); else await check("reference on the runner", c.referencePython);
      }
      return { c, tests };
    } catch (e) { feedback = (e as Error).message; console.log(`  retry challenge (${attempt}): ${feedback.slice(0, 200)}`); }
  }
  throw new Error(`could not draft the problem for ${m.key}`);
}

async function lessonsMode(cfg: Cfg, which: string) {
  const picked = (await cfg.modules()).filter((m) => which === "all" || m.key === which);
  if (picked.length === 0) throw new Error("no such module");
  mkdirSync(`${cfg.dir}/generated`, { recursive: true });
  for (const m of picked) {
    console.log(`Module ${m.key}`);
    const sources: string[] = [];
    for (const spec of m.lessons) { console.log(` lesson ${spec.key}`); sources.push(lessonSource(spec, await draftLesson(cfg, m, spec))); }
    console.log(" module problem");
    const { c, tests } = await draftChallenge(cfg, m);
    writeFileSync(`${cfg.dir}/${m.file}.ts`, `import { lesson, q, sec, type TrackModule } from "../types";\n\n// Drafted by scripts/author-lang.mts: every example was run on the runner and its output is the real one.\nexport const ${m.export}: TrackModule = {\n  key: ${q(m.key)},\n  title: ${q(m.title)},\n  summary: ${q(m.summary)},\n  lessons: [\n${sources.join("\n")}\n  ],\n};\n`);
    writeFileSync(`${cfg.dir}/generated/${m.key}.json`, JSON.stringify({ key: m.key, title: c.title, statement: c.statement, inputFormat: c.inputFormat, outputFormat: c.outputFormat, constraints: c.constraints, exampleCount: 2, explanations: c.explanations, reference: c.referencePython, tests, ...(cfg.nativeSolution ? { solution: c.solution } : {}) }, null, 2) + "\n");
    console.log(` wrote ${m.file}.ts and generated/${m.key}.json`);
  }
}

// ------------------------------------------------------------------------------------------------ questions
const GEN = "./gen-code-questions.mts";
const Draft = z.object({ specs: z.array(z.object({
  top: z.string().max(800).optional(), body: z.string().min(10).max(1100),
  alt: z.array(z.tuple([z.string().min(1).max(120), z.string().min(1).max(120)])).min(1).max(6),
  wrong: z.array(z.string().min(1).max(100)).min(3).max(5), why: z.string().min(20).max(400),
})).min(10).max(16) });

async function questionsMode(cfg: Cfg, which: string) {
  const { build } = (await import(GEN)) as { build: (track: string, lang: Language, specs: readonly Spec[]) => Promise<{ bank: Record<string, unknown[]>; problems: string[] }> };
  const { lang } = (await import(cfg.questionsModule)) as { lang: Language };
  const picked = (await cfg.modules()).filter((m) => which === "all" || m.key === which);
  if (picked.length === 0) throw new Error("no such module");
  const header = `// GENERATED by scripts/author-lang.mts. Snippets only: the answers are produced by running them (npm run questions:gen -- ${cfg.track}).\nimport type { Spec } from "../gen-code-questions.mts";\n\nexport const extra: Spec[] = `;
  const kept: Spec[] = existsSync(cfg.questionsExtra) ? (JSON.parse(readFileSync(cfg.questionsExtra, "utf8").split("export const extra: Spec[] = ")[1].replace(/;\s*$/, "")) as Spec[]) : [];
  const system = `You write "what does this program print?" questions for first-year ${cfg.track} students. Each spec has: ${cfg.questionRules} "alt" = 2 to 5 ONE-EDIT mistakes, each a [from, to] text replacement where "from" occurs EXACTLY in the code as written and the edit gives a program that still runs but prints DIFFERENT output (the mistakes students really make: off-by-one, = vs ==, / vs //, wrong format, wrong loop bound), "wrong" = 3 or 4 DIFFERENT outputs a student might wrongly expect, in exactly the same format as the real output, and "why" = a plain-English reason (short sentences, simple words) for the real output.\nRules: deterministic, no input, prints one to three short lines, output under 100 characters. Different specs must test different ideas from the module.`;
  for (const m of picked) {
    const good: Spec[] = [];
    for (let round = 1; round <= 4 && good.length < 10; round++) {
      const { value } = await generateStructured({ task: "general", promptVersion: "author-lang-q-1", schema: Draft, temperature: 0.5, maxTokens: 14000, system,
        user: `Module "${m.title}": ${m.summary}\nLessons: ${m.lessons.map((l) => `${l.title} (${l.brief})`).join(" | ")}\nWrite 13 specs spread over all the lessons.` });
      const specs: Spec[] = value.specs.map((s) => ({ m: m.key, ...(s.top ? { top: s.top } : {}), body: s.body, alt: s.alt as [string, string][], wrong: s.wrong, why: s.why }));
      const { problems } = await build(cfg.track, lang, specs);
      const bad = new Set(problems.map((p) => Number(/#(\d+):/.exec(p)?.[1]) - 1));
      specs.forEach((s, i) => { if (!bad.has(i) && good.length < 12 && !good.some((g) => g.body.trim() === s.body.trim())) good.push(s); });
      console.log(`${m.key} round ${round}: ${specs.length - bad.size}/${specs.length} usable, ${good.length} kept`);
    }
    if (good.length < 8) throw new Error(`only ${good.length} usable snippets for ${m.key}`);
    for (let i = kept.length - 1; i >= 0; i--) if (kept[i].m === m.key) kept.splice(i, 1);
    kept.push(...good);
    writeFileSync(cfg.questionsExtra, header + JSON.stringify(kept, null, 2) + ";\n");
  }
}

// ------------------------------------------------------------------------------------------------ analogies
const shortSentences = (s: string) => s.split(/(?<=[.!?])\s+/).every((x) => x.split(/\s+/).length <= 25);
const Item = z.object({
  icon: z.string().min(1).max(8), title: z.string().min(3).max(40), text: z.string().min(40).max(220).refine(shortSentences, "every sentence at most 25 words"),
  pairs: z.array(z.tuple([z.string().min(2).max(60), z.string().min(2).max(60)])).min(3).max(4), differs: z.string().min(40).max(220).refine(shortSentences, "every sentence at most 25 words"),
});
const Batch = z.object({ analogies: z.array(Item.extend({ key: z.string() })) });

async function analogiesMode(cfg: Cfg) {
  const out: Record<string, unknown> = {};
  for (const m of await cfg.modules()) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { value } = await generateStructured({ task: "general", promptVersion: "author-lang-a-1", schema: Batch, temperature: 0.5, maxTokens: 4000,
          system: `You write one everyday analogy per programming lesson for first-generation college students in India with English as a second language. Use things they know: a railway station, a tiffin box, cricket, a ration shop, buses, a school register, a kirana shop, a bank queue. "icon" is ONE emoji. "text" explains the idea in short sentences. "pairs" are 3 or 4 [everyday thing, code idea] rows. "differs" is honest: where the analogy stops being true. Never claim something false about ${cfg.track}. Plain words.`,
          user: `Module "${m.title}". Write one analogy for each lesson, using exactly these keys:\n${m.lessons.map((l) => `- ${l.key}: ${l.title} (${l.brief})`).join("\n")}` });
        const keys = new Set(value.analogies.map((a) => a.key));
        const missing = m.lessons.filter((l) => !keys.has(l.key));
        if (missing.length) throw new Error(`missing ${missing.map((l) => l.key).join(", ")}`);
        for (const a of value.analogies) { const { key, ...rest } = a; if (m.lessons.some((l) => l.key === key)) out[`${cfg.track}/${key}`] = rest; }
        console.log(`${m.key}: ${m.lessons.length} analogies`);
        break;
      } catch (e) { console.log(`${m.key} retry ${attempt}: ${(e as Error).message.slice(0, 160)}`); if (attempt === 3) throw e; }
    }
  }
  writeFileSync(cfg.analogyFile, `import type { Analogy } from "./analogies";\n\n// Generated by scripts/author-lang.mts.\nexport const ${cfg.analogyExport}: Record<string, Analogy> = ${JSON.stringify(out, null, 2)};\n`);
}

// ------------------------------------------------------------------------------------------------ index
function indexMode(cfg: Cfg) {
  const dir = `${cfg.dir}/generated`;
  const items = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Record<string, unknown> & { key: string; solution?: string });
  const challenges = Object.fromEntries(items.map(({ key, solution: _s, ...c }) => [key, c]));
  writeFileSync(`${cfg.dir}/challenges-extra.ts`, `import type { ModuleChallenge } from "../types";\n\n// Generated by scripts/author-lang.mts index from ${dir}. Expected outputs come from running each Python reference.\nexport const extraChallenges: Record<string, ModuleChallenge> = ${JSON.stringify(challenges, null, 2)};\n`);
  if (cfg.nativeSolution) {
    const natives = Object.fromEntries(items.map((i) => [`${cfg.track}/${i.key}`, i.solution]));
    writeFileSync(`${cfg.dir}/native-extra.ts`, `// Generated by scripts/author-lang.mts index: an independent ${cfg.track} solution per module problem, re-run by CI and \`npm run runner:verify\`.\nexport const extraNativeSolutions: Record<string, string> = ${JSON.stringify(natives, null, 2)};\n`);
  }
  console.log(`wrote ${items.length} challenges`);
}

async function main() {
  const [mode, track, which = "all"] = process.argv.slice(2);
  const cfg = CONFIGS[track];
  if (!cfg || !["lessons", "questions", "analogies", "index"].includes(mode)) throw new Error(`usage: author <lessons|questions|analogies|index> <${Object.keys(CONFIGS).join("|")}> [moduleKey|all]`);
  if (mode === "lessons") await lessonsMode(cfg, which);
  else if (mode === "questions") await questionsMode(cfg, which);
  else if (mode === "analogies") await analogiesMode(cfg);
  else indexMode(cfg);
}
main().catch((e) => { console.error(e); process.exit(1); });
