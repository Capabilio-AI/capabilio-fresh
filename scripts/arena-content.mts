/**
 * Authoring CLI for Arena challenges (no deploy needed).
 *   npm run arena:content -- templates                 upsert workstation templates from content/arena/templates.json
 *   npm run arena:content -- validate <file|dir>...     validate specs offline (SQL via sql.js, notebooks via local python3)
 *   npm run arena:content -- import <file|dir>...       validate, then import as DRAFT (records the validation)
 *   npm run arena:content -- publish <spec-key>...      DRAFT -> PUBLISHED (only a validated, unchanged spec)
 *   npm run arena:content -- retire <spec-key>...
 *   npm run arena:content -- list
 *   npm run arena:content -- grant-admin <email>        make a user a Capabilio admin
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ChallengeSpec, TemplateSpec } from "../lib/arena-content/spec";
import { specHash } from "../lib/arena-content/hash";
import { sqlJsRunner } from "../lib/arena-content/sqljs-runner";
import { runLocalPython } from "../lib/arena-content/python-runner";
import { grantPlatformAdmin, importSpec, listChallenges, loadReferenceData, markValidated, publishChallenge, retireChallenge, upsertTemplates } from "../lib/arena-content/store";
import { validateSpec } from "../lib/arena-content/validate";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local).");
const service = createClient(url, key, { auth: { persistSession: false } });

const TEMPLATES_FILE = "content/arena/templates.json";
const [command, ...args] = process.argv.slice(2);

function specFiles(paths: string[]): string[] {
  return paths.flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith(".json")).sort().map((f) => join(p, f)) : [p]));
}
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));

async function loadSpecs(paths: string[]): Promise<{ file: string; spec: ChallengeSpec }[]> {
  const out: { file: string; spec: ChallengeSpec }[] = [];
  for (const file of specFiles(paths)) {
    const json = readJson(file);
    for (const item of Array.isArray(json) ? json : [json]) {
      const parsed = ChallengeSpec.safeParse(item);
      if (!parsed.success) {
        console.error(`✗ ${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
        process.exitCode = 1;
      } else out.push({ file, spec: parsed.data });
    }
  }
  return out;
}

async function validateAll(paths: string[]) {
  const reference = await loadReferenceData(service);
  const templatesFromFile = TemplateSpec.array().parse(readJson(TEMPLATES_FILE));
  // templates in the file count as available, so specs can be validated before the templates are imported
  const templates = new Map([...reference.templates, ...templatesFromFile.map((t) => [t.key, t] as const)]);
  const results = [];
  for (const { file, spec } of await loadSpecs(paths)) {
    const report = await validateSpec(spec, { ...reference, templates, runSql: sqlJsRunner, runPython: runLocalPython });
    console.log(`${report.ok ? "✓" : "✗"} ${spec.key} (${file})${report.ok ? ` — a pass is ${report.evidenceStatus}` : ""}`);
    for (const e of report.errors) console.log(`    error: ${e}`);
    for (const w of report.warnings) console.log(`    warning: ${w}`);
    if (!report.ok) process.exitCode = 1;
    results.push({ spec, report });
  }
  return results;
}

switch (command) {
  case "templates": {
    const templates = TemplateSpec.array().parse(readJson(TEMPLATES_FILE));
    await upsertTemplates(service, templates);
    console.log(`upserted ${templates.length} templates`);
    break;
  }
  case "validate":
    await validateAll(args);
    break;
  case "import": {
    const results = await validateAll(args);
    if (process.exitCode) {
      console.log("Nothing imported: fix the errors above first.");
      break;
    }
    for (const { spec } of results) {
      const r = await importSpec(service, spec);
      await markValidated(service, { id: r.id });
      console.log(`${r.changed ? "imported" : "unchanged"} ${spec.key} as DRAFT (validated ${specHash(spec).slice(0, 8)})`);
    }
    break;
  }
  case "publish":
    for (const k of args) {
      await publishChallenge(service, { key: k }, null);
      console.log(`published ${k}`);
    }
    break;
  case "retire":
    for (const k of args) {
      await retireChallenge(service, { key: k });
      console.log(`retired ${k}`);
    }
    break;
  case "list":
    for (const c of await listChallenges(service)) console.log(`${c.status.padEnd(9)} ${c.track.padEnd(6)} ${c.difficulty.padEnd(6)} ${(c.specKey ?? "(no spec)").padEnd(40)} ${c.title}${c.isSeed ? "  [seed]" : ""}${c.hasSpec ? (c.validated ? "" : "  [needs validation]") : ""}`);
    break;
  case "grant-admin":
    console.log(`granted platform admin to ${await grantPlatformAdmin(service, args[0] ?? "")}`);
    break;
  default:
    console.log("commands: templates | validate | import | publish | retire | list | grant-admin");
    process.exitCode = 1;
}
