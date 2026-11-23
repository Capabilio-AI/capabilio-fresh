import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cTrack } from "./c";
import { pythonTrack } from "./python";
import { assessmentPool, MIN_CODE_QUESTIONS } from "./module-gate";
import type { Track } from "./types";

// the tracks that have a generated code-reading bank (add a track here when its bank is generated)
const banked: Track[] = [cTrack, pythonTrack];

describe("code-reading question banks", () => {
  for (const t of banked) {
    it(`${t.key}: every module has enough questions, each well formed`, () => {
      for (const m of t.modules) {
        const qs = m.codeQuestions ?? [];
        expect(qs.length, `${t.key}/${m.key}`).toBeGreaterThanOrEqual(MIN_CODE_QUESTIONS);
        expect(new Set(qs.map((q) => q.id)).size, `${m.key}: ids`).toBe(qs.length);
        expect(new Set(qs.map((q) => q.code)).size, `${m.key}: the same program twice`).toBe(qs.length);
        for (const q of qs) {
          const where = `${q.id}`;
          expect(new Set(q.options).size, `${where}: options must all differ`).toBe(4);
          expect(q.options.every((o) => o.length > 0 && o.length <= 160), where).toBe(true);
          expect(Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex <= 3, where).toBe(true);
          expect(q.code.length, where).toBeGreaterThan(20);
          expect(q.why.length, where).toBeGreaterThan(10);
        }
        // the right answer is not always in the same place
        expect(new Set(qs.map((q) => q.answerIndex)).size, `${m.key}: answer positions`).toBeGreaterThan(1);
      }
    });
    it(`${t.key}: the assessment of each module draws from the code questions`, () => {
      for (const m of t.modules) expect(assessmentPool(m).every((q) => q.code !== undefined), m.key).toBe(true);
    });
  }
});

describe("the answers never reach the browser", () => {
  // a client component that imported a track (or its question bank) would put every answer into the page bundle
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
    }
    return out;
  };
  it("no 'use client' file imports the track registry, a track folder, or a question bank", () => {
    const bad: string[] = [];
    for (const f of ["components", "app"].flatMap((d) => walk(d))) {
      const src = readFileSync(f, "utf8");
      if (!/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(src)) continue;
      for (const m of src.matchAll(/from "(@\/lib\/languages(?:\/[\w-]+)*)"/g)) {
        if (m[1] === "@/lib/languages" || /^@\/lib\/languages\/(c|cpp|java|python|sql|html|javascript|csharp)(\/|$)/.test(m[1]) || m[1].endsWith("code-questions")) bad.push(`${f} imports ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
