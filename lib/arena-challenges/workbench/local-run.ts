// Runs OUR OWN verified programs (never a student's) on this machine, to check bug tasks before they are stored. Python, JavaScript, C and C++.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizeOutput } from "../leetcode/judge";
import type { MutantLang } from "./mutate";

const dir = mkdtempSync(path.join(tmpdir(), "workbench-"));
const sh = (cmd: string, args: string[], input?: string) => spawnSync(cmd, args, { input, encoding: "utf8", timeout: 2000 });
// the judge runs GCC, where <bits/stdc++.h> exists; here (clang) the umbrella header is spelled out
const spellOut = (code: string) => code.replace("#include <bits/stdc++.h>", "#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <cmath>\n#include <string>");

/** One output per input; "ERR:..." when the program fails to build, crashes or times out. */
export function runLocal(lang: MutantLang, code: string, inputs: readonly string[]): string[] {
  if (lang === "python" || lang === "javascript") {
    const file = path.join(dir, lang === "python" ? "p.py" : "p.js");
    writeFileSync(file, code);
    const [cmd, args] = lang === "python" ? ["python3", ["-I", file]] as const : ["node", [file]] as const;
    return runEach(inputs, (i) => sh(cmd, [...args], i));
  }
  const src = path.join(dir, lang === "c" ? "p.c" : "p.cpp");
  const bin = path.join(dir, "p.bin");
  writeFileSync(src, lang === "cpp" ? spellOut(code) : code);
  const c = lang === "c" ? sh("gcc", ["-O1", "-o", bin, src]) : sh("g++", ["-O1", "-std=c++17", "-o", bin, src]);
  if (c.status !== 0) return inputs.map(() => "ERR:compile");
  return runEach(inputs, (i) => sh(bin, [], i));
}

/** Runs each input; after the first timeout the rest are marked timed out without waiting again (a looping mutant would otherwise cost seconds per test). */
function runEach(inputs: readonly string[], run: (input: string) => ReturnType<typeof sh>): string[] {
  const out: string[] = [];
  let hung = false;
  for (const i of inputs) {
    if (hung) { out.push("ERR:timeout"); continue; }
    const r = run(i);
    const o = r.status === 0 ? normalizeOutput(r.stdout) : `ERR:${r.status ?? "timeout"}`;
    if (o === "ERR:timeout") hung = true;
    out.push(o);
  }
  return out;
}
