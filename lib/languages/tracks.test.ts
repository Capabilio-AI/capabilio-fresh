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
import { runCode } from "@/lib/code-execution/wandbox";
import { allLessons, type Track } from "./types";

const tracks: Track[] = [cTrack, javaTrack, pythonTrack, cppTrack, sqlTrack];

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
  if (["c", "cpp", "python", "sql"].includes(track.key)) {
    const dir = mkdtempSync(path.join(tmpdir(), `${track.key}-lessons-`));
    it.each(examples.map((e) => [e.id, e.code] as const))("example %s runs cleanly", (id, code) => {
      const input = "3 4\n";
      if (track.key === "python") {
        const src = path.join(dir, `${id}.py`);
        writeFileSync(src, code);
        const run = spawnSync("python3", ["-I", "-W", "error", src], { input, encoding: "utf8", timeout: 30000 });
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
});
