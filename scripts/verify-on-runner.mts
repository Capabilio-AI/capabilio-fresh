// Runs every module problem's reference solution on the runner students really use (self-hosted Judge0 when JUDGE0_URL is set) and compares each
// test's output. CI checks Java with JDK 21 and C# with .NET 8; the runner has older compilers (Java 13, Mono 6.6, Python 3.8), so only this finds a
// solution or lesson that works in CI and fails for a student. Usage: npm run runner:verify        Writes nothing. Exit code 1 on any failure.
import { runCode } from "@/lib/code-execution/wandbox";
import { judge0Configured } from "@/lib/code-execution/judge0";
import { NATIVE_SOLUTIONS } from "@/lib/languages/native-solutions";
import { allLessons, isHtmlChallenge, isSqlChallenge, type ModuleChallenge, type Track } from "@/lib/languages/types";
import { cTrack } from "@/lib/languages/c";
import { javaTrack } from "@/lib/languages/java";
import { pythonTrack } from "@/lib/languages/python";
import { cppTrack } from "@/lib/languages/cpp";
import { javascriptTrack } from "@/lib/languages/javascript";
import { csharpTrack } from "@/lib/languages/csharp";

const tracks: Track[] = [cTrack, javaTrack, pythonTrack, cppTrack, javascriptTrack, csharpTrack];
const only = process.argv[2]; // optional: a track key, e.g. java
const RUNNER_LANGUAGE: Record<string, string> = { c: "c", java: "java", python: "python", cpp: "cpp", javascript: "javascript", csharp: "csharp" };

console.log(judge0Configured() ? `Runner: self-hosted Judge0 (${process.env.JUDGE0_URL})` : "Runner: shared public Wandbox (set JUDGE0_URL to test the real one)");

const jobs = tracks.filter((t) => !only || t.key === only).flatMap((t) =>
  t.modules.filter((m) => m.challenge && !isSqlChallenge(m.challenge) && !isHtmlChallenge(m.challenge)).map((m) => {
    const c = m.challenge as ModuleChallenge;
    // the Python track's own problem is solved by its reference; every other track by the independent solution written in that language
    const code = t.key === "python" ? c.reference : NATIVE_SOLUTIONS[`${t.key}/${m.key}`];
    return { id: `${t.key}/${m.key}`, lang: RUNNER_LANGUAGE[t.key], code, tests: c.tests };
  }));

// every lesson's own code example, run once with the input "3 4": it must compile and finish without an error (a page example is not code to run)
const exampleJobs = tracks.filter((t) => !only || t.key === only).flatMap((t) => allLessons(t).flatMap((l) => l.lesson.sections.flatMap((sec, i) => {
  const code = sec.example?.code;
  if (!code || code.trimStart().startsWith("<")) return [];
  return [{ id: `example ${t.key}/${l.key}-${i}`, lang: RUNNER_LANGUAGE[t.key], code, tests: [{ input: "3 4\n", output: "" }], isExample: true }];
})));

const CRASH = /Traceback|Error|Exception|error:|Segmentation|core dumped|Aborted|NZEC|Time limit/;
// every code-reading question: the option marked right must be exactly what the program prints (the bank is generated from real runs; this proves it again)
const codeLang = async (key: string) => { try { return ((await import(`./code-questions/${key}.mts`)) as { lang: { wrap(shown: string): string } }).lang; } catch { return null; } };
const questionJobs = (await Promise.all(tracks.filter((t) => !only || t.key === only).map(async (t) => {
  const lang = await codeLang(t.key);
  if (!lang) return [];
  return t.modules.flatMap((m) => (m.codeQuestions ?? []).map((q) => ({ id: `question ${q.id}`, lang: RUNNER_LANGUAGE[t.key], code: lang.wrap(q.code), tests: [{ input: "", output: q.options[q.answerIndex] }], isExample: false, trimmed: true })));
}))).flat();

type Row = { id: string; result: "ok" | "FAIL" | "MISSING"; detail: string; ms: number };
const rows: Row[] = [];
async function check(j: (typeof queue)[number]): Promise<void> {
  const start = Date.now();
  if (!j.code) { rows.push({ id: j.id, result: "MISSING", detail: "no solution to run", ms: 0 }); return; }
  for (const [i, t] of j.tests.entries()) {
    let r;
    try { r = await runCode(j.lang, j.code, t.input); } catch (e) { rows.push({ id: j.id, result: "FAIL", detail: `test ${i + 1}: runner error: ${(e as Error).message}`, ms: Date.now() - start }); return; }
    if (r.compileError) { rows.push({ id: j.id, result: "FAIL", detail: `does not compile: ${r.compileError.split("\n").slice(0, 2).join(" | ").slice(0, 160)}`, ms: Date.now() - start }); return; }
    // a lesson may print to stderr on purpose (a debugging lesson does); only a crash-like message counts as a failure
    if (j.isExample) { if (CRASH.test(r.stderr)) { rows.push({ id: j.id, result: "FAIL", detail: `runtime: ${r.stderr.split("\n").slice(0, 2).join(" | ").slice(0, 170)}`, ms: Date.now() - start }); return; } continue; }
    const same = j.trimmed ? r.stdout.replace(/\r/g, "").split("\n").map((l) => l.trimEnd()).join("\n").trimEnd() === t.output : r.stdout === t.output;
    if (!same) { rows.push({ id: j.id, result: "FAIL", detail: `test ${i + 1}: expected ${JSON.stringify(t.output).slice(0, 50)} got ${JSON.stringify(r.stdout).slice(0, 50)} ${r.stderr.slice(0, 80)}`, ms: Date.now() - start }); return; }
  }
  rows.push({ id: j.id, result: "ok", detail: "", ms: Date.now() - start });
}

// two at a time: the runner has two worker slots
const queue = [...jobs.map((j) => ({ ...j, isExample: false, trimmed: false })), ...exampleJobs.map((j) => ({ ...j, trimmed: false })), ...questionJobs];
await Promise.all([0, 1].map(async () => { for (let j = queue.shift(); j; j = queue.shift()) await check(j); }));

rows.sort((a, b) => a.id.localeCompare(b.id));
console.table(rows);
const bad = rows.filter((r) => r.result !== "ok");
console.log(bad.length ? `\n${bad.length} of ${rows.length} problems do NOT pass on this runner.` : `\nAll ${rows.length} problems pass on this runner.`);
process.exit(bad.length ? 1 : 0);
