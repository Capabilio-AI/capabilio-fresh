// Pre-builds roles from a list of job titles so the first student who picks one does not wait: for each title it matches or creates the
// role (with its skill profile), builds the roadmap, projects and certifications, and optionally fills the assessment question pool.
// Slow and uses the AI providers, so it does one role at a time and stops after --limit roles.
//   npm run roles:build                          dry run: shows which titles already exist and which would be built (no AI calls)
//   npm run roles:build -- --apply --limit 5     builds up to 5 new roles
//   npm run roles:build -- --apply --questions   also fills the assessment question pool (many more AI calls)
//   npm run roles:build -- --apply --regenerate  also rebuilds roles whose roadmap the AI wrote earlier, with live market data and role-sized skills (a roadmap a person authored is never replaced)
//   npm run roles:build -- --file other.json     use another list ({ "roles": ["Title", ...] })
import { readFileSync } from "node:fs";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveRole } from "@/lib/assess/roles";
import { loadCareerSkills } from "@/lib/assess/db";
import { warmPool } from "@/lib/assess/pool";
import { executeRun, requestGeneration } from "@/lib/roadmap-generate/runs";
import { ensureRequirements } from "@/lib/roadmap-generate/requirements";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args[args.indexOf(`--${name}`) + 1];
const apply = flag("apply");
const withQuestions = flag("questions");
const regenerate = flag("regenerate");
const limit = flag("limit") ? Number(value("limit")) : Infinity;
const file = flag("file") ? value("file") : "content/market-roles/roles.json";
const titles: string[] = (JSON.parse(readFileSync(file, "utf8")) as { roles: string[] }).roles;

const service = createServiceClient();
const db = service as never;
const report: { title: string; role: string; result: string }[] = [];
let built = 0;

for (const title of titles) {
  if (built >= limit) break;
  if (!apply) {
    const { data } = await (service as any).rpc("match_careers", { p_query: title, p_limit: 1 });
    const best = (data ?? [])[0] as { name: string; score: number } | undefined;
    const exists = best && best.score >= 0.8;
    report.push({ title, role: exists ? best.name : "-", result: exists ? "exists" : "would build" });
    continue;
  }
  try {
    const out = await resolveRole(db, title);
    if (out.status === "REJECTED") { report.push({ title, role: "-", result: `rejected: ${out.message}` }); continue; }
    const career = out.primary;
    const notes: string[] = [out.status === "GENERATED" ? "profile created" : "role exists"];
    let force = false;
    if (regenerate) {
      const { data: published } = await (service as any).from("roadmap_templates").select("source").eq("career_id", career.careerId).eq("status", "PUBLISHED").maybeSingle();
      force = published?.source === "AI_GENERATED";
    }
    const start = await requestGeneration(service, career.careerId, { force });
    if (start.state === "STARTED") { await executeRun(service, start.runId, career.careerId); notes.push("roadmap built"); }
    else notes.push(`roadmap ${start.state.toLowerCase()}`);
    const added = await ensureRequirements(service, career.careerId);
    if (added) notes.push(`${added} skills from roadmap`);
    if (withQuestions) {
      const skills = await loadCareerSkills(db, career.careerId);
      const reports = await warmPool(db, { career: { id: career.careerId, key: career.key, name: career.name }, skills }, {}, 400);
      notes.push(`+${reports.reduce((a, r) => a + r.inserted, 0)} questions`);
    }
    if (out.status === "GENERATED" || start.state === "STARTED") built++;
    report.push({ title, role: career.name, result: notes.join(", ") });
  } catch (e) {
    report.push({ title, role: "-", result: `FAILED: ${e instanceof Error ? e.message : e}` });
  }
}
console.table(report);
console.log(apply ? `${built} roles built.` : `Dry run: ${report.filter((r) => r.result === "would build").length} of ${titles.length} titles would be built; ${report.filter((r) => r.result === "exists").length} already exist.`);
