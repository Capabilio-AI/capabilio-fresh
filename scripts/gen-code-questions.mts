// Builds the code-reading question bank of one track by RUNNING code on the real code runner (self-hosted Judge0 when JUDGE0_URL is set).
//   npm run questions:gen -- c        Writes lib/languages/<track>/code-questions.ts. Writes nothing if any snippet is rejected.
//
// Every question is a short program ("what does it print?"). The correct option is the program's real output. The wrong options are the real outputs of the
// same program with one realistic mistake applied (x++ for ++x, = for ==, / for %, ...), or a hand-written plausible output when a mistake cannot be run.
// Nothing about the answer is typed by hand, so a question cannot have a wrong key.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { runCode } from "@/lib/code-execution/wandbox";
import type { CodeQuestion } from "@/lib/languages/types";

/** one mistake: a text replacement, or several that are applied together */
export type Alt = readonly [string, string] | readonly (readonly [string, string])[];
export interface Spec {
  /** the module key the question belongs to */
  m: string;
  /** declarations before main (functions, structs, macros) */
  top?: string;
  /** the body of main, one statement per line, without indentation */
  body: string;
  alt?: readonly Alt[];
  /** plausible wrong outputs that cannot be produced by running a mistake of the code */
  wrong?: readonly string[];
  why: string;
  stdin?: string;
}
export interface Language {
  /** the runner language id */
  language: string;
  /** the text a student sees for a spec */
  show(spec: Spec): string;
  /** the text actually run for a student-visible program (adds headers and the like) */
  wrap(shown: string): string;
}

const norm = (s: string) => s.replace(/\r/g, "").split("\n").map((l) => l.trimEnd()).join("\n").trimEnd();
const hash = (s: string) => parseInt(createHash("sha1").update(s).digest("hex").slice(0, 8), 16);
const CACHE = "/tmp/code-questions-cache.json";
const cache: Record<string, string> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

async function output(lang: Language, shown: string, stdin: string): Promise<string | null> {
  const code = lang.wrap(shown);
  const key = createHash("sha1").update(`${lang.language}\n${stdin}\n${code}`).digest("hex");
  if (key in cache) return cache[key] === "\u0000" ? null : cache[key];
  let result: string | null = null;
  for (let attempt = 0; attempt < 3 && result === null; attempt++) {
    try {
      const r = await runCode(lang.language, code, stdin);
      if (r.compileError || /Time limit|Segmentation|core dumped|Aborted|Killed/i.test(r.stderr)) { cache[key] = "\u0000"; return null; }
      result = norm(r.stdout);
    } catch { await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1))); }
  }
  if (result === null) throw new Error("the runner did not answer");
  cache[key] = result;
  return result;
}

const apply = (shown: string, alt: Alt): string | null => {
  const pairs = (typeof alt[0] === "string" ? [alt] : alt) as readonly (readonly [string, string])[];
  let s = shown;
  for (const [from, to] of pairs) { if (!s.includes(from)) return null; s = s.replace(from, to); }
  return s === shown ? null : s;
};

const sane = (o: string) => o.length > 0 && o.length <= 160 && o.split("\n").length <= 6 && !/[^\x09\x0a\x20-\x7e]/.test(o);

export async function build(trackKey: string, lang: Language, specs: readonly Spec[]): Promise<{ bank: Record<string, CodeQuestion[]>; problems: string[] }> {
  const bank: Record<string, CodeQuestion[]> = {};
  const problems: string[] = [];
  const counts: Record<string, number> = {};
  let next = 0;
  const results: (CodeQuestion | null)[] = new Array(specs.length).fill(null);
  async function worker() {
    for (let i = next++; i < specs.length; i = next++) {
      const spec = specs[i];
      const label = `${spec.m} #${i + 1}`;
      try {
        const shown = lang.show(spec);
        const right = await output(lang, shown, spec.stdin ?? "");
        if (right === null || !sane(right)) { problems.push(`${label}: the program does not run cleanly or prints something unsuitable (${JSON.stringify(right)})`); continue; }
        const wrongs: string[] = [];
        for (const alt of spec.alt ?? []) {
          const mutated = apply(shown, alt);
          if (mutated === null) { problems.push(`${label}: a mistake edit does not match the code: ${JSON.stringify(alt).slice(0, 80)}`); continue; }
          const o = await output(lang, mutated, spec.stdin ?? "");
          if (o !== null && sane(o) && o !== right && !wrongs.includes(o)) wrongs.push(o);
        }
        for (const w of spec.wrong ?? []) if (norm(w) !== right && !wrongs.includes(norm(w))) wrongs.push(norm(w));
        if (wrongs.length < 3) { problems.push(`${label}: only ${wrongs.length} distinct wrong answers (need 3); the right output is ${JSON.stringify(right)}`); continue; }
        const options = [right, ...wrongs.slice(0, 3)];
        const id = `${trackKey}:${spec.m}:${i}`;
        // a fixed shuffle per question, so the right answer is not always in the same place
        const order = options.map((o, k) => ({ o, k, h: hash(`${id}:${o}`) })).sort((a, b) => a.h - b.h);
        results[i] = { id, code: shown, question: "What does this program print?", options: order.map((x) => x.o) as CodeQuestion["options"], answerIndex: order.findIndex((x) => x.k === 0), why: spec.why };
      } catch (e) { problems.push(`${label}: ${(e as Error).message}`); }
    }
  }
  await Promise.all([worker(), worker()]);
  writeFileSync(CACHE, JSON.stringify(cache));
  specs.forEach((s, i) => { const q = results[i]; if (q) { (bank[s.m] ??= []).push({ ...q, id: `${trackKey}:${s.m}:${(counts[s.m] = (counts[s.m] ?? 0) + 1)}` }); } });
  return { bank, problems };
}

export function render(trackKey: string, bank: Record<string, CodeQuestion[]>): string {
  return `// GENERATED by scripts/gen-code-questions.mts (npm run questions:gen -- ${trackKey}). Do not edit by hand: every answer is the real output of the code on the runner.
// Server only: these hold the answers, so only the module test route may import this (never a client component).
import type { CodeQuestion } from "../types";

export const codeQuestions: Record<string, CodeQuestion[]> = ${JSON.stringify(bank, null, 2)};
`;
}

if (process.argv[1]?.endsWith("gen-code-questions.mts")) {
  const track = process.argv[2];
  if (!track) { console.error("usage: npm run questions:gen -- <track>"); process.exit(2); }
  const mod = (await import(`./code-questions/${track}.mts`)) as { lang: Language; specs: readonly Spec[] };
  console.log(`${track}: ${mod.specs.length} snippets, runner ${process.env.JUDGE0_URL ?? "shared Wandbox (set JUDGE0_URL for the real one)"}`);
  const { bank, problems } = await build(track, mod.lang, mod.specs);
  const total = Object.values(bank).reduce((n, q) => n + q.length, 0);
  for (const [m, qs] of Object.entries(bank)) console.log(`  ${m}: ${qs.length}`);
  if (problems.length) { console.log(`\n${problems.length} problem(s), nothing written:`); problems.forEach((p) => console.log("  - " + p)); process.exit(1); }
  writeFileSync(`lib/languages/${track}/code-questions.ts`, render(track, bank));
  console.log(`\nwrote lib/languages/${track}/code-questions.ts: ${total} questions`);
}
