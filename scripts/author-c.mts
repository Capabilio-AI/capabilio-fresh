// Drafts the new C modules with the model, then PROVES them on the real runner before anything is written: every example must compile and print something,
// and its stated output is the runner's output, never the model's claim. The module problem's expected outputs come from running its Python reference, and
// its C solution must match them on the runner. Usage: npm run author:c -- <moduleKey|all>   (set LLM_MODEL=claude-sonnet-5-5 and JUDGE0_URL/JUDGE0_TOKEN)
// Writes lib/languages/c/<file>.ts, lib/languages/c/generated/<module>.json (challenge + C solution). Re-running a module replaces its files.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync as writeTmp } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/llm";
import { runCode } from "@/lib/code-execution/wandbox";
import { C_MODULES, type LessonSpec, type ModuleSpec } from "./authoring/c-modules";

const STYLE = `You write lessons for first-generation college students in India (tier-2 and tier-3 colleges) who have English as a second language and little patience for theory. Rules:
- Short sentences, at most 20 words. Plain words. Explain a new term the first time it appears. No idioms.
- Teach with small programs. Every program is COMPLETE C that compiles with gcc, reads NO input, prints something, and returns 0.
- Never put the program's output in your text: it is added by running the program.
- Be correct above all. No undefined behaviour in examples. Mention a real limit or trap where one exists.
- Each program is at most 35 lines. Compile it in your head with gcc -std=c11 -Wall -Wextra: no warnings at all (no signed/unsigned comparisons, no unused variables).
- Each lesson: 2 or 3 sections, each with 2 short paragraphs and exactly one example. 3 takeaways. 3 common mistakes. 4 check questions.
- Check questions test understanding, not memory: at least two ask what a small program prints or why a bug happens. "wrong" answers must be plausible mistakes a student really makes, and all four options must be different.`;

const Lesson = z.object({
  summary: z.string().min(40).max(320),
  sections: z.array(z.object({ heading: z.string().min(3).max(70), paragraphs: z.array(z.string().min(30).max(520)).length(2), example: z.object({ title: z.string().min(3).max(70), code: z.string().min(30).max(880), explanation: z.string().min(30).max(420) }) })).min(2).max(3),
  takeaways: z.array(z.string().min(10).max(160)).length(3),
  mistakes: z.array(z.string().min(10).max(200)).length(3),
  check: z.array(z.object({ question: z.string().min(12).max(300), right: z.string().min(1).max(120), wrong: z.array(z.string().min(1).max(120)).length(3), why: z.string().min(20).max(320) })).length(4),
});
type DraftLesson = z.infer<typeof Lesson>;

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** Places the right answer at a position that depends on the lesson and question, so answers are not always in the same slot. */
function arrange(key: string, i: number, right: string, wrong: string[]): { options: [string, string, string, string]; answerIndex: 0 | 1 | 2 | 3 } {
  const at = (hash(`${key}:${i}`) % 4) as 0 | 1 | 2 | 3;
  const options = [...wrong]; options.splice(at, 0, right);
  return { options: options as [string, string, string, string], answerIndex: at };
}

async function proveExamples(spec: LessonSpec, d: DraftLesson): Promise<string | null> {
  for (const s of d.sections) {
    const dir = mkdtempSync(join(tmpdir(), "authc-"));
    writeTmp(join(dir, "a.c"), s.example.code);
    const cc = spawnSync("gcc", ["-Wall", "-Wextra", "-std=c11", "-o", join(dir, "a"), join(dir, "a.c")], { encoding: "utf8" });
    if (cc.stderr.trim()) return `Example "${s.example.title}" gives compiler warnings or errors with gcc -Wall -Wextra -std=c11: ${cc.stderr.slice(0, 400)}`;
    const r = await runCode("c", s.example.code, "");
    if (r.compileError.trim()) return `Example "${s.example.title}" did not compile: ${r.compileError.slice(0, 400)}`;
    if (r.stderr.trim()) return `Example "${s.example.title}" failed at run time: ${r.stderr.slice(0, 300)}`;
    if (!r.stdout.trim()) return `Example "${s.example.title}" printed nothing.`;
    (s.example as { out?: string }).out = r.stdout.replace(/\r\n/g, "\n").trimEnd();
  }
  if (new Set(d.check.map((c) => c.question)).size !== d.check.length) return "Two check questions are the same.";
  for (const c of d.check) if (new Set([c.right, ...c.wrong]).size !== 4) return `A check question has repeated options: ${c.question}`;
  return null;
}

async function draftLesson(m: ModuleSpec, spec: LessonSpec): Promise<DraftLesson> {
  let feedback = "";
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { value } = await generateStructured({ task: "general", promptVersion: "author-c-1", schema: Lesson, temperature: 0.4, maxTokens: 6000, system: STYLE,
      user: `Write the C lesson "${spec.title}" for the module "${m.title}". It must teach: ${spec.brief}${feedback ? `\n\nYour last draft was rejected: ${feedback}\nFix exactly that.` : ""}` });
    const problem = await proveExamples(spec, value);
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
    const explanation = `${s.example.explanation.trim()} Output: ${out.replace(/\n/g, " / ")}`;
    return `        sec(${q(s.heading)}, [${s.paragraphs.map(q).join(", ")}], { title: ${q(s.example.title)}, code: ${q(s.example.code.trimEnd() + "\n")}, explanation: ${q(explanation)} }),`;
  }).join("\n");
  const checks = d.check.map((c, i) => { const a = arrange(spec.key, i, c.right, c.wrong); return `        q(${q(c.question)}, [${a.options.map(q).join(", ")}], ${a.answerIndex}, ${q(c.why)}),`; }).join("\n");
  return `    lesson(${q(spec.key)}, ${q(spec.title)}, ${spec.minutes}, {
      summary: ${q(d.summary)},
      sections: [
${sections}
      ],
      takeaways: [${d.takeaways.map(q).join(", ")}],
      mistakes: [${d.mistakes.map(q).join(", ")}],
      check: [
${checks}
      ],
    }),`;
}

const Challenge = z.object({
  title: z.string().min(3).max(60), statement: z.string().min(60).max(700), inputFormat: z.string().min(5).max(250), outputFormat: z.string().min(5).max(250),
  constraints: z.array(z.string().min(3).max(100)).min(1).max(4),
  inputs: z.array(z.string().min(1).max(400)).min(7).max(9), explanations: z.array(z.string().min(15).max(220)).length(2),
  referencePython: z.string().min(20).max(1500), solutionC: z.string().min(40).max(3000),
});

async function draftChallenge(m: ModuleSpec) {
  let feedback = "";
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { value: c } = await generateStructured({ task: "general", promptVersion: "author-c-challenge-1", schema: Challenge, temperature: 0.3, maxTokens: 4000,
      system: `${STYLE}\nYou now write ONE programming problem that proves a module. Standard input to standard output. Give 7 to 9 inputs: the first two are shown as examples, the rest are hidden and must include edge cases (smallest, largest, a trap). Write an independent Python 3 reference and a C solution. Inputs must be valid for the constraints. Every input ends without a trailing blank line.`,
      user: `Module "${m.title}". The problem: ${m.challengeBrief}${feedback ? `\n\nYour last draft was rejected: ${feedback}\nFix exactly that.` : ""}` });
    try {
      const tests: { input: string; output: string }[] = [];
      for (const raw of c.inputs) {
        const input = raw.endsWith("\n") ? raw : raw + "\n";
        const output = execFileSync("python3", ["-I", "-c", c.referencePython], { input, encoding: "utf8", timeout: 10_000 });
        if (!output.trim()) throw new Error("the Python reference printed nothing for an input");
        tests.push({ input, output });
      }
      for (const t of tests) {
        const r = await runCode("c", c.solutionC, t.input);
        if (r.compileError.trim()) throw new Error(`the C solution did not compile: ${r.compileError.slice(0, 300)}`);
        if (r.stdout.replace(/\r\n/g, "\n").trimEnd() !== t.output.trimEnd()) throw new Error(`the C solution and the Python reference disagree on input ${JSON.stringify(t.input)}: C printed ${JSON.stringify(r.stdout.slice(0, 120))}, Python printed ${JSON.stringify(t.output.slice(0, 120))}`);
      }
      return { c, tests };
    } catch (e) { feedback = (e as Error).message; console.log(`  retry challenge (${attempt}): ${feedback.slice(0, 200)}`); }
  }
  throw new Error(`could not draft the problem for ${m.key}`);
}

async function main() {
  const which = process.argv[2];
  const picked = C_MODULES.filter((m) => which === "all" || m.key === which);
  if (picked.length === 0) throw new Error(`usage: author:c <${C_MODULES.map((m) => m.key).join("|")}|all>`);
  mkdirSync("lib/languages/c/generated", { recursive: true });
  for (const m of picked) {
    console.log(`Module ${m.key}`);
    const sources: string[] = [];
    for (const spec of m.lessons) { console.log(` lesson ${spec.key}`); sources.push(lessonSource(spec, await draftLesson(m, spec))); }
    console.log(" module problem");
    const { c, tests } = await draftChallenge(m);
    writeFileSync(`lib/languages/c/${m.file}.ts`, `import { lesson, q, sec, type TrackModule } from "../types";\n\n// Drafted by scripts/author-c.mts: every example was run on the runner and its output is the real one.\nexport const ${m.export}: TrackModule = {\n  key: ${q(m.key)},\n  title: ${q(m.title)},\n  summary: ${q(m.summary)},\n  lessons: [\n${sources.join("\n")}\n  ],\n};\n`);
    writeFileSync(`lib/languages/c/generated/${m.key}.json`, JSON.stringify({ key: m.key, title: c.title, statement: c.statement, inputFormat: c.inputFormat, outputFormat: c.outputFormat, constraints: c.constraints, exampleCount: 2, explanations: c.explanations, reference: c.referencePython, tests, solutionC: c.solutionC }, null, 2) + "\n");
    console.log(` wrote ${m.file}.ts and generated/${m.key}.json`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
