import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { TheoryLesson } from "@/lib/skillstudio/lesson-content";
import { cTrack } from "./c";
import { javaTrack } from "./java";
import { pythonTrack } from "./python";
import { cppTrack } from "./cpp";
import { sqlTrack } from "./sql";
import { htmlTrack } from "./html";
import { javascriptTrack } from "./javascript";
import { csharpTrack } from "./csharp";
import { runCode } from "@/lib/code-execution/wandbox";
import { allLessons, type Track } from "./types";
import { checkHtmlExample } from "./verify-examples";
import { NATIVE_SOLUTIONS } from "./native-solutions";
import { isHtmlChallenge, isSqlChallenge, type ModuleChallenge } from "./types";

const tracks: Track[] = [cTrack, javaTrack, pythonTrack, cppTrack, sqlTrack, htmlTrack, javascriptTrack, csharpTrack];

describe.each(tracks)("$title track", (track) => {
  const lessons = allLessons(track);

  it("has unique module and lesson keys", () => {
    const keys = lessons.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(track.modules.map((m) => m.key)).size).toBe(track.modules.length);
  });

  it.each(lessons.map((l) => [l.key, l] as const))("lesson %s matches the lesson schema", (_k, l) => {
    expect(TheoryLesson.safeParse(l.lesson).success, JSON.stringify(TheoryLesson.safeParse(l.lesson).error?.issues.slice(0, 2))).toBe(true);
    for (const c of l.lesson.check) expect(new Set(c.options).size).toBe(4);
  });

  const examples = lessons.flatMap((l) => l.lesson.sections.flatMap((s, i) => (s.example?.code ? [{ id: `${l.key}-${i}`, code: s.example.code }] : [])));
  if (["c", "cpp", "python", "sql", "javascript"].includes(track.key)) {
    const dir = mkdtempSync(path.join(tmpdir(), `${track.key}-lessons-`));
    it.each(examples.map((e) => [e.id, e.code] as const))("example %s runs cleanly", (id, code) => {
      const input = "3 4\n";
      if (track.key === "python") {
        const src = path.join(dir, `${id}.py`);
        writeFileSync(src, code);
        const run = spawnSync("python3", ["-I", "-W", "error", src], { input, encoding: "utf8", timeout: 30000 });
        expect(run.status, run.stderr).toBe(0);
      } else if (track.key === "javascript") {
        // a page with a script is checked as a page (markup, CSS and script syntax); plain scripts run under Node and must exit cleanly
        if (code.trimStart().startsWith("<")) {
          expect(checkHtmlExample(code)).toEqual([]);
          return;
        }
        const src = path.join(dir, `${id}.js`);
        writeFileSync(src, code);
        const run = spawnSync("node", [src], { encoding: "utf8", timeout: 30000 });
        expect(run.status, run.stderr).toBe(0);
      } else if (track.key === "sql") {
        // every example is a complete script that builds its own tables, so it runs on a fresh in-memory database
        const run = spawnSync("python3", ["-I", "-c", "import sqlite3,sys; c=sqlite3.connect(':memory:'); c.executescript(sys.stdin.read())"], { input: code, encoding: "utf8", timeout: 30000 });
        expect(run.status, run.stderr).toBe(0);
      } else {
        const cpp = track.key === "cpp";
        const src = path.join(dir, `${id}.${cpp ? "cpp" : "c"}`);
        const bin = path.join(dir, id);
        writeFileSync(src, code);
        const cc = spawnSync(cpp ? "g++" : "gcc", ["-Wall", "-Wextra", cpp ? "-std=c++20" : "-std=c11", "-o", bin, src], { encoding: "utf8" });
        expect(cc.stderr, cc.stderr).toBe("");
        const run = spawnSync(bin, [], { input, encoding: "utf8", timeout: 30000 });
        expect(run.status, run.stderr).toBe(0);
      }
    });
  }

  // Java has no local compiler on every machine, so its examples run on the public runner only when asked: LIVE_RUNNER=1 npx vitest run lib/languages
  if (track.key === "java") {
    it.skipIf(!process.env.LIVE_RUNNER).each(examples.map((e) => [e.id, e.code] as const))("example %s compiles and runs", async (_id, code) => {
      // the shared runner answers 429 under load: pause between examples and retry with a growing wait
      let r: Awaited<ReturnType<typeof runCode>> | null = null;
      for (let attempt = 1; attempt <= 5 && !r; attempt++) {
        await new Promise((ok) => setTimeout(ok, 2500 * attempt));
        r = await runCode("java", code, "3 4\n").catch((e: Error) => (/429/.test(e.message) ? null : Promise.reject(e)));
      }
      if (!r) throw new Error("the public runner kept refusing (429)");
      expect(r.compileError, r.compileError).toBe("");
      expect(r.stderr, r.stderr).toBe("");
    }, 90_000);
  }

  // HTML examples are pages: markup, CSS and script syntax are checked (lib/languages/verify-examples.ts); the page itself is rendered in the lesson
  if (track.key === "html") {
    it.each(examples.map((e) => [e.id, e.code] as const))("example %s is a sound page", (_id, code) => {
      expect(checkHtmlExample(code)).toEqual([]);
    });
  }

  // Java and C# need a real compiler. Where one is installed the examples are compiled and run; where not they are skipped locally and REQUIRED in CI
  // (REQUIRE_RUNTIMES=1), so a missing compiler fails the CI job instead of quietly passing.
  const need = Boolean(process.env.REQUIRE_RUNTIMES);
  const has = (cmd: string, args: string[]) => spawnSync(cmd, args, { encoding: "utf8" }).status === 0;
  if (track.key === "java") {
    it.skipIf(!need && !has("javac", ["-version"])).each(examples.map((e) => [e.id, e.code] as const))("example %s compiles and runs under a local JDK", (id, code) => {
      const d = mkdtempSync(path.join(tmpdir(), `java-${id}-`));
      // the file must be named after its public class; the class to run is the one that holds main
      const file = `${/public\s+(?:final\s+)?class\s+(\w+)/.exec(code)?.[1] ?? "Main"}.java`;
      writeFileSync(path.join(d, file), code);
      const mainAt = code.search(/static\s+void\s+main/);
      const owners = [...code.slice(0, Math.max(mainAt, 0)).matchAll(/\b(?:class|record|enum)\s+(\w+)/g)];
      const mainClass = owners.length ? owners[owners.length - 1][1] : "Main";
      const cc = spawnSync("javac", ["-d", d, path.join(d, file)], { encoding: "utf8", timeout: 60000 });
      expect(cc.status, cc.stderr).toBe(0);
      const run = spawnSync("java", ["-cp", d, mainClass], { input: "3 4\n", encoding: "utf8", timeout: 60000 });
      expect(run.status, run.stderr).toBe(0);
    }, 120_000);
  }
  if (track.key === "csharp") {
    const proj = need || has("dotnet", ["--version"]) ? mkdtempSync(path.join(tmpdir(), "cs-lessons-")) : null;
    if (proj) {
      writeFileSync(path.join(proj, "L.csproj"), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup></Project>');
    }
    it.skipIf(!proj).each(examples.map((e) => [e.id, e.code] as const))("example %s builds and runs under the .NET SDK", (_id, code) => {
      writeFileSync(path.join(proj!, "Program.cs"), code);
      const run = spawnSync("dotnet", ["run", "--project", proj!, "--nologo", "-v", "q"], { input: "3 4\n", encoding: "utf8", timeout: 180000 });
      expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
    }, 240_000);
  }
});

// A module's problem must be sound before a student meets it: every expected output is what the reference solution really prints, and the shape is right.
describe("module challenges", () => {
  // stdin/stdout problems; SQL and page problems have their own checks in sql-challenges.test.ts and html-challenges.test.ts
  const withChallenge = tracks.flatMap((t) => t.modules.filter((m) => m.challenge && !isSqlChallenge(m.challenge) && !isHtmlChallenge(m.challenge)).map((m) => [`${t.key}/${m.key}`, m] as const));
  const ch = (m: { challenge?: unknown }) => m.challenge as ModuleChallenge;
  it("exist for at least one module", () => expect(withChallenge.length).toBeGreaterThan(0));
  it.each(withChallenge)("%s: shape and examples", (_id, m) => {
    const c = ch(m);
    expect(c.tests.length).toBeGreaterThanOrEqual(5);
    expect(c.exampleCount).toBeGreaterThanOrEqual(1);
    expect(c.exampleCount).toBeLessThan(c.tests.length);
    expect(c.explanations).toHaveLength(c.exampleCount);
    expect(new Set(c.tests.map((t) => t.input)).size, "duplicate test inputs").toBe(c.tests.length);
    // an input may be empty or end without a line break (a program must cope with both); an expected output always ends with one
    for (const t of c.tests) expect(t.output.endsWith("\n")).toBe(true);
  });
  it.each(withChallenge)("%s: the reference prints exactly the expected output on every test", (id, m) => {
    for (const t of ch(m).tests) {
      const run = spawnSync("python3", ["-I", "-c", ch(m).reference], { input: t.input, encoding: "utf8", timeout: 20000 });
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout, `${id} on ${JSON.stringify(t.input)}`).toBe(t.output);
    }
  });

  // an independent solution in the track's own language must pass every test: it finds statements that read differently outside Python
  const dir2 = mkdtempSync(path.join(tmpdir(), "native-"));
  const native = withChallenge.filter(([id]) => NATIVE_SOLUTIONS[id] && !id.startsWith("java/") && !id.startsWith("csharp/"));
  it.each(native)("%s: a solution written in the track's own language passes every test", (id, m) => {
    const code = NATIVE_SOLUTIONS[id];
    const lang = id.split("/")[0];
    const safe = id.replace(/\W/g, "_");
    let cmd: string[];
    if (lang === "javascript") { const f = path.join(dir2, `${safe}.js`); writeFileSync(f, code); cmd = ["node", f]; }
    else {
      const f = path.join(dir2, `${safe}.${lang === "cpp" ? "cpp" : "c"}`);
      const bin = path.join(dir2, safe);
      writeFileSync(f, code);
      const cc = spawnSync(lang === "cpp" ? "g++" : "gcc", [lang === "cpp" ? "-std=c++17" : "-std=c11", "-O1", "-o", bin, f], { encoding: "utf8" });
      expect(cc.status, cc.stderr).toBe(0);
      cmd = [bin];
    }
    for (const t of ch(m).tests) {
      const run = spawnSync(cmd[0], cmd.slice(1), { input: t.input, encoding: "utf8", timeout: 20000 });
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout, `${id} on ${JSON.stringify(t.input).slice(0, 80)}`).toBe(t.output);
    }
  });
  it("has a native solution for every C, C++ and JavaScript module problem", () => {
    const missing = withChallenge.filter(([id]) => /^(c|cpp|javascript)\//.test(id) && !NATIVE_SOLUTIONS[id]).map(([id]) => id);
    expect(missing).toEqual([]);
  });
});

