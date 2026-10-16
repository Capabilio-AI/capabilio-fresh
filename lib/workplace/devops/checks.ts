import { z } from "zod";
import { parse as parseYaml } from "yaml";

import type { CheckResult, ConfigFile } from "../file-tasks/types";
export type { CheckResult, ConfigFile };

const PATTERN = z
  .string()
  .min(1)
  .max(120)
  // nested quantifiers and backreferences can make a regex run for ages on hostile input
  .refine((p) => !/\([^)]*[+*][^)]*\)[+*{]/.test(p) && !/\\[1-9]/.test(p), "pattern is not allowed")
  .refine((p) => {
    try {
      new RegExp(p, "i");
      return true;
    } catch {
      return false;
    }
  }, "not a valid pattern");

const label = z.string().min(6).max(140);
const file = z.string().min(1).max(60);

/** What a ticket requires of the files. Declarative on purpose: the AI describes the checks, safe code runs them, no AI-written code is executed. */
export const CheckSchema = z.discriminatedUnion("kind", [
  /** a value (or values, with [*] for every item) at a path inside a YAML file */
  z.object({ kind: z.literal("yaml"), label, file, path: z.string().min(1).max(120), op: z.enum(["exists", "not_exists", "equals", "contains", "matches", "all_match", "count_gte"]), value: z.union([z.string().max(120), z.number(), z.boolean()]).optional() }),
  /** the instructions of a Dockerfile */
  z.object({ kind: z.literal("docker"), label, file, instr: z.string().regex(/^[A-Za-z]+$/), op: z.enum(["exists", "not_exists", "matches", "all_match", "first_matches", "last_matches", "before"]), value: PATTERN.optional(), other: PATTERN.optional() }),
  /** a pattern in the raw text of any file (shell, nginx, Terraform ...) */
  z.object({ kind: z.literal("regex"), label, file, pattern: PATTERN, op: z.enum(["matches", "not_matches"]) }),
]);
export type Check = z.infer<typeof CheckSchema>;

/** Every value found at a path like `jobs.build.steps[*].uses` or `spec.containers[0].image`. */
export function valuesAt(root: unknown, path: string): unknown[] {
  let current: unknown[] = [root];
  for (const part of path.split(".")) {
    const m = /^([^[\]]*)((?:\[(?:\*|\d+)\])*)$/.exec(part);
    if (!m) return [];
    const [, key, indexes] = m;
    // "*" as a key means every value of an object, for things named by the author such as CloudFormation resources
    if (key === "*") current = current.flatMap((v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.values(v) : []));
    else if (key) current = current.flatMap((v) => (v && typeof v === "object" && !Array.isArray(v) && key in v ? [(v as Record<string, unknown>)[key]] : []));
    for (const ix of indexes.match(/\[(\*|\d+)\]/g) ?? []) {
      const at = ix.slice(1, -1);
      current = current.flatMap((v) => (Array.isArray(v) ? (at === "*" ? v : at in v ? [v[Number(at)]] : []) : []));
    }
  }
  return current.filter((v) => v !== undefined);
}

const text = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v) ?? "");
const re = (p: string) => new RegExp(p, "i");

function yamlCheck(c: Extract<Check, { kind: "yaml" }>, content: string): boolean {
  let docs: unknown[];
  try {
    docs = content.split(/^---\s*$/m).filter((d) => d.trim()).map((d) => parseYaml(d, { logLevel: "error" }));
  } catch {
    return false;
  }
  const found = docs.flatMap((d) => valuesAt(d, c.path));
  const want = c.value;
  switch (c.op) {
    case "exists": return found.length > 0;
    case "not_exists": return found.length === 0;
    case "equals": return found.some((v) => v === want || text(v) === text(want));
    case "contains": return found.some((v) => text(v).toLowerCase().includes(text(want).toLowerCase()));
    case "matches": return found.some((v) => re(text(want)).test(text(v)));
    case "all_match": return found.length > 0 && found.every((v) => re(text(want)).test(text(v)));
    case "count_gte": return found.length >= Number(want);
  }
}

export interface Instruction {
  instr: string;
  args: string;
}

/** Instructions of a Dockerfile, with line continuations joined and comments dropped. */
export function parseDockerfile(content: string): Instruction[] {
  const out: Instruction[] = [];
  let pending = "";
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!pending && (line === "" || line.startsWith("#"))) continue;
    pending += (pending ? " " : "") + line.replace(/\\$/, "").trim();
    if (line.endsWith("\\")) continue;
    const m = /^(\S+)\s*(.*)$/.exec(pending);
    if (m) out.push({ instr: m[1].toUpperCase(), args: m[2] });
    pending = "";
  }
  return out;
}

function dockerCheck(c: Extract<Check, { kind: "docker" }>, content: string): boolean {
  const all = parseDockerfile(content);
  const mine = all.filter((i) => i.instr === c.instr.toUpperCase());
  const ok = (i: Instruction) => (c.value ? re(c.value).test(i.args) : true);
  switch (c.op) {
    case "exists": return mine.some(ok);
    case "not_exists": return !mine.some(ok);
    case "matches": return mine.some(ok);
    case "all_match": return mine.length > 0 && mine.every(ok);
    case "first_matches": return mine.length > 0 && ok(mine[0]);
    case "last_matches": return mine.length > 0 && ok(mine[mine.length - 1]);
    case "before": {
      const first = all.findIndex((i) => i.instr === c.instr.toUpperCase() && ok(i));
      const later = c.other ? all.findIndex((i) => re(c.other!).test(`${i.instr} ${i.args}`)) : -1;
      return first >= 0 && later >= 0 && first < later;
    }
  }
}

export function runChecks(files: readonly ConfigFile[], checks: readonly Check[]): CheckResult[] {
  return checks.map((c) => {
    const f = files.find((x) => x.name === c.file);
    if (!f) return { label: c.label, passed: false };
    try {
      const passed = c.kind === "yaml" ? yamlCheck(c, f.content) : c.kind === "docker" ? dockerCheck(c, f.content) : (c.op === "matches") === re(c.pattern).test(f.content);
      return { label: c.label, passed };
    } catch {
      return { label: c.label, passed: false };
    }
  });
}
