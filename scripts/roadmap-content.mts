/**
 * Authoring CLI for the visual roadmap's taxonomy and content (no deploy needed). Nothing here ever makes content live by itself.
 *   npm run roadmap:content -- skills validate [file]     check the child-skills spec against the live taxonomy (default content/skills/roadmap-child-skills.json)
 *   npm run roadmap:content -- skills import [file]       validate, then add the skills as CANDIDATES (inactive; usable by nothing)
 *   npm run roadmap:content -- skills activate <key>...   reviewer action: make candidate skills active (or: --all-from-file [file])
 *   npm run roadmap:content -- templates validate <file|dir>...   check topic trees (add --allow-pending to accept skills still awaiting review)
 *   npm run roadmap:content -- templates import <file|dir>...     validate, then save as DRAFT (every skill must already be active)
 *   npm run roadmap:content -- templates review <id> --as <email> a Capabilio admin reviews a draft (the reviewer is recorded)
 *   npm run roadmap:content -- templates publish <id>             REVIEWED -> PUBLISHED (the career's previous published version is retired)
 *   npm run roadmap:content -- templates retire <id> | list | export <id>
 *   npm run roadmap:content -- skills pending             list candidates created from the spec file that are still inactive
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { grantPlatformAdmin } from "../lib/arena-content/store";
import { exportTemplate, importTemplate, listTemplates, loadTemplateReference, publishTemplate, retireTemplate, reviewTemplate } from "../lib/roadmap-visual/template-store";
import { importItems, publishItems } from "../lib/roadmap-visual/diagnostic-store";
import { importCareerExtras, importResources } from "../lib/roadmap-visual/resource-import";
import { ItemSpec, itemProblems } from "../lib/roadmap-visual/diagnostic";
import { validateTemplateSpec } from "../lib/roadmap-visual/template-spec";
import { ChildSkillsFile, activateSkills, importChildSkillsAsCandidates, loadTaxonomy, validateChildSkills } from "../lib/roadmap-visual/skills-spec";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local).");
const service = createClient(url, key, { auth: { persistSession: false } });

const DEFAULT_FILE = "content/skills/roadmap-child-skills.json";
const [area, command, ...args] = process.argv.slice(2);
const fileArg = () => args.find((a) => !a.startsWith("--")) ?? DEFAULT_FILE;
const readSpec = (file: string) => ChildSkillsFile.parse(JSON.parse(readFileSync(file, "utf8"))).skills;

async function validate(file: string) {
  const spec = readSpec(file);
  const { existing, aliases } = await loadTaxonomy(service);
  const report = validateChildSkills(spec, existing, aliases);
  for (const e of report.errors) console.log(`error: ${e}`);
  for (const w of report.warnings) console.log(`warning: ${w}`);
  console.log(report.errors.length ? `✗ ${report.errors.length} error(s) in ${spec.length} skills` : `✓ ${spec.length} skills are valid`);
  if (report.errors.length) process.exitCode = 1;
  return { spec, ok: report.errors.length === 0 };
}

const files = (paths: string[]) => paths.filter((p) => !p.startsWith("--")).flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith(".json")).sort().map((f) => join(p, f)) : [p]));
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

async function templateCommand() {
  if (command === "validate" || command === "import") {
    const ref = await loadTemplateReference(service);
    let failed = false;
    for (const file of files(args)) {
      const v = validateTemplateSpec(JSON.parse(readFileSync(file, "utf8")), ref, { allowPendingSkills: args.includes("--allow-pending") });
      console.log(`${v.ok ? "✓" : "✗"} ${file}${v.spec ? ` (${v.spec.career}, ${v.spec.nodes.filter((n) => n.type === "TOPIC").length} topics)` : ""}`);
      for (const e of v.errors) console.log(`    error: ${e}`);
      for (const w of v.warnings.slice(0, 8)) console.log(`    warning: ${w}`);
      if (v.warnings.length > 8) console.log(`    ... and ${v.warnings.length - 8} more warnings`);
      if (!v.ok) failed = true;
      else if (command === "import") console.log("   ", await importTemplate(service, v.spec));
    }
    if (failed) process.exitCode = 1;
  } else if (command === "review") {
    const email = flag("--as");
    if (!email) throw new Error("review needs --as <email of a Capabilio admin>");
    const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error(`${email} is not a user`);
    const { data: admin } = await service.from("platform_admins" as never).select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) throw new Error(`${email} is not a Capabilio admin. Grant it first: npm run arena:content -- grant-admin ${email}`);
    await reviewTemplate(service, args[0], user.id);
    console.log("reviewed");
  } else if (command === "publish") {
    await publishTemplate(service, args[0]);
    console.log("published");
  } else if (command === "retire") {
    await retireTemplate(service, args[0]);
    console.log("retired");
  } else if (command === "export") {
    console.log(JSON.stringify((await exportTemplate(service, args[0])).spec, null, 2));
  } else if (command === "list") {
    for (const t of await listTemplates(service)) console.log(`${t.status.padEnd(9)} ${t.careerKey.padEnd(22)} v${t.version} ${String(t.topics).padStart(3)} topics  ${t.id}`);
  } else {
    console.log("commands: validate | import | review | publish | retire | export | list");
    process.exitCode = 1;
  }
}

async function diagnosticsCommand() {
  const file = args.find((a) => !a.startsWith("--")) ?? "content/diagnostics/items.v1.json";
  if (command === "validate" || command === "import") {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const problems = ((raw.items ?? []) as unknown[]).flatMap((e, n) => { const r = ItemSpec.safeParse(e); return r.success ? itemProblems(r.data).map((p) => `item ${n + 1}: ${p}`) : [`item ${n + 1}: ${r.error.issues[0]?.message}`]; });
    problems.forEach((p) => console.log(`error: ${p}`));
    if (problems.length) { process.exitCode = 1; return; }
    if (command === "validate") return console.log(`✓ ${raw.items.length} items are well-formed (skills are checked on import)`);
    const report = await importItems(service, raw, null);
    report.errors.forEach((e) => console.log(`error: ${e}`));
    console.log(`inserted ${report.inserted}, unchanged ${report.unchanged}${report.errors.length ? `, ${report.errors.length} error(s)` : ""}`);
    if (report.errors.length) process.exitCode = 1;
  } else if (command === "publish") {
    const email = flag("--as");
    if (!email) throw new Error("publish needs --as <email of a Capabilio admin>");
    const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error(`${email} is not a user`);
    const { data: admin } = await service.from("platform_admins" as never).select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) throw new Error(`${email} is not a Capabilio admin`);
    console.log(`published ${await publishItems(service, user.id)} item(s), reviewer recorded`);
  } else {
    console.log("commands: validate | import | publish --as <email>");
    process.exitCode = 1;
  }
}

if (area === "extras") {
  const report = await importCareerExtras(service, JSON.parse(readFileSync(args.find((a) => !a.startsWith("--")) ?? "content/resources/career-extras.v1.json", "utf8")));
  report.errors.forEach((e) => console.log(`error: ${e}`));
  console.log(`inserted ${report.inserted}, existing ${report.updated}${report.errors.length ? `, ${report.errors.length} problem(s)` : ""}`);
  if (report.errors.length) process.exitCode = 1;
} else if (area === "resources") {
  const file = args.find((a) => !a.startsWith("--")) ?? "content/resources/learning.v1.json";
  const report = await importResources(service, JSON.parse(readFileSync(file, "utf8")));
  report.errors.forEach((e) => console.log(`error: ${e}`));
  console.log(`inserted ${report.inserted}, updated ${report.updated}${report.errors.length ? `, ${report.errors.length} problem(s)` : ""}`);
  if (report.errors.length) process.exitCode = 1;
} else if (area === "templates") {
  await templateCommand();
} else if (area === "diagnostics") {
  await diagnosticsCommand();
} else if (area !== "skills") {
  console.log("usage: roadmap:content skills <validate|import|activate|pending> ...");
  process.exitCode = 1;
} else if (command === "validate") {
  await validate(fileArg());
} else if (command === "import") {
  const { spec, ok } = await validate(fileArg());
  if (ok) console.log(await importChildSkillsAsCandidates(service, spec), "(imported as inactive candidates)");
} else if (command === "activate") {
  const keys = args.includes("--all-from-file") ? readSpec(fileArg()).map((s) => s.key) : args;
  if (keys.length === 0) throw new Error("name at least one skill key, or pass --all-from-file");
  console.log(`activated ${await activateSkills(service, keys)} of ${keys.length}`);
} else if (command === "pending") {
  const keys = new Set(readSpec(fileArg()).map((s) => s.key));
  const { data } = await service.from("skills").select("key, name, status").eq("status", "candidate").in("key", [...keys]);
  for (const s of data ?? []) console.log(`${s.key}  ${s.name}`);
  console.log(`${data?.length ?? 0} candidate(s) awaiting review`);
} else {
  console.log("commands: validate | import | activate | pending");
  process.exitCode = 1;
}
