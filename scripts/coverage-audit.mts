// Read-only coverage audit: for every language track and every Arena role, is there content to LEARN from, PRACTISE on and PROVE with?
// Usage: npm run coverage:audit            (the report)
//        npm run coverage:audit -- --md    (also writes docs/coverage-report.md)
// Writes nothing to the database. Every threshold below is a named constant, so "covered" means one stated thing, not a feeling.
// What counts as what is spelled out in the report footer; the point is a denominator, so a percentage can be trusted and watched over time.
import { writeFileSync } from "node:fs";
import { createServiceClient } from "@/lib/supabase/service";
import { TRACKS } from "@/lib/languages";
import { allLessons } from "@/lib/languages/types";
import { ROLE_CATALOG } from "@/lib/arena-roles/catalog";
import { proofMix } from "@/lib/languages/tier-proof";
import { TIERS } from "@/lib/languages/tiers";
import { TEMPLATE_REGISTRY, templatesPerArea } from "@/lib/arena-workstations/template-registry";

const db = createServiceClient() as any;

/** Thresholds: below these a thing is "thin", not "covered". Change them here and the whole report changes with them. */
const MIN_PRACTICE_PER_LESSON = 3; // verified exercises stored per language lesson
const MIN_TASKS_PER_AREA = 8; // tasks per enabled Arena skill area of a role: published rows plus templates written in code
const MIN_ASSESS_PER_SKILL = 6; // assessment questions per required skill
const MIN_LESSON_SHARE = 0.8; // share of roadmap topics that have a stored lesson
const MIN_BANK_PER_TIER_DIFFICULTY = 40; // problems per difficulty a tier proof draws from, so weeks do not repeat quickly
const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${Math.round((n / d) * 100)}%`);

async function all<T>(table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const q = db.from(table).select(columns);
    const { data, error } = await (filter ? filter(q) : q).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const [exercises, challenges, areas, domainRoles, careers, requirements, templates, nodes, lessons, pool] = await Promise.all([
  all<{ topic_key: string }>("lesson_exercises", "topic_key", (q) => q.not("verified_at", "is", null)),
  all<{ track: string; kind: string; difficulty: string; skill_area_key: string | null; status: string; scope_key: string | null }>("arena_challenges", "track,kind,difficulty,skill_area_key,status,scope_key", (q) => q.eq("status", "PUBLISHED")),
  all<{ role_key: string; area_key: string; enabled: boolean; tool_type: string | null }>("arena_skill_areas", "role_key,area_key,enabled,tool_type"),
  all<{ role_key: string; enabled: boolean }>("arena_domain_roles", "role_key,enabled"),
  all<{ id: string; key: string; name: string }>("careers", "id,key,name", (q) => q.eq("is_active", true)),
  all<{ career_id: string; skill_id: string }>("career_skill_requirements", "career_id,skill_id"),
  all<{ id: string; career_id: string; source: string }>("roadmap_templates", "id,career_id,source", (q) => q.eq("status", "PUBLISHED")),
  all<{ template_id: string; node_key: string }>("roadmap_nodes", "template_id,node_key"),
  all<{ career_id: string; node_key: string }>("skillstudio_lessons", "career_id,node_key", (q) => q.eq("kind", "theory")),
  all<{ career_id: string; skill_id: string }>("assess_question_pool", "career_id,skill_id", (q) => q.eq("is_active", true)),
]);

// ---------- A. language tracks ----------
const exercisesBy = new Map<string, number>();
for (const e of exercises) exercisesBy.set(e.topic_key, (exercisesBy.get(e.topic_key) ?? 0) + 1);
const trackRows = TRACKS.map((t) => {
  const ls = allLessons(t);
  const withExample = ls.filter((l) => l.lesson.sections.some((s) => s.example?.code)).length;
  const practised = ls.filter((l) => (exercisesBy.get(`track:${t.key}:${l.key}`) ?? 0) >= MIN_PRACTICE_PER_LESSON).length;
  const withProblem = t.modules.filter((m) => m.challenge).length;
  return { track: t.title, modules: t.modules.length, "modules with a proving problem": withProblem, lessons: ls.length, "with runnable example": withExample, [`lessons with >=${MIN_PRACTICE_PER_LESSON} exercises`]: practised, practice: pct(practised, ls.length) };
});

// ---------- B. proof bank (what the tier proofs draw from) ----------
const bank = new Map<string, number>();
for (const c of challenges) if (c.track === "stream" && c.kind === "leetcode") bank.set(c.difficulty, (bank.get(c.difficulty) ?? 0) + 1);
const need = (d: string) => TIERS.map((t) => t.n).filter((n) => proofMix(n).includes(d as never));
const bankRows = (["easy", "medium", "hard"] as const).map((d) => ({ difficulty: d, problems: bank.get(d) ?? 0, "tiers drawing on it": need(d).join(","), enough: (bank.get(d) ?? 0) >= MIN_BANK_PER_TIER_DIFFICULTY ? "yes" : `no (<${MIN_BANK_PER_TIER_DIFFICULTY})` }));

// ---------- C. the whole Arena bank ----------
const arenaCount = new Map<string, number>();
for (const c of challenges) arenaCount.set(`${c.track}/${c.kind}`, (arenaCount.get(`${c.track}/${c.kind}`) ?? 0) + 1);
const arenaRows = [...arenaCount.entries()].sort().map(([k, n]) => ({ "track/kind": k, published: n }));

// ---------- D. roles ----------
const careerByName = new Map(careers.map((c) => [c.name.toLowerCase(), c]));
const roleEnabled = new Map(domainRoles.map((r) => [r.role_key, r.enabled]));
const templateCount = templatesPerArea();
const tasksByArea = new Map<string, number>();
for (const c of challenges) if (c.track === "domain" && c.skill_area_key) tasksByArea.set(c.skill_area_key, (tasksByArea.get(c.skill_area_key) ?? 0) + 1);
const templateOf = new Map(templates.map((t) => [t.career_id, t]));
const nodesOf = new Map<string, number>();
for (const n of nodes) nodesOf.set(n.template_id, (nodesOf.get(n.template_id) ?? 0) + 1);
const lessonsOf = new Map<string, number>();
for (const l of lessons) lessonsOf.set(l.career_id, (lessonsOf.get(l.career_id) ?? 0) + 1);
const skillsOf = new Map<string, Set<string>>();
for (const r of requirements) skillsOf.set(r.career_id, (skillsOf.get(r.career_id) ?? new Set()).add(r.skill_id));
const poolBy = new Map<string, number>();
for (const q of pool) poolBy.set(`${q.career_id}:${q.skill_id}`, (poolBy.get(`${q.career_id}:${q.skill_id}`) ?? 0) + 1);

const roleRows = ROLE_CATALOG.map((r) => {
  const career = careerByName.get(r.name.toLowerCase().split(" / ")[0]) ?? null;
  const tpl = career ? templateOf.get(career.id) : undefined;
  const topicCount = tpl ? (nodesOf.get(tpl.id) ?? 0) : 0;
  const stored = career ? (lessonsOf.get(career.id) ?? 0) : 0;
  const roleAreas = r.domainRoleKey ? areas.filter((a) => a.role_key === r.domainRoleKey && a.enabled) : [];
  const tasksIn = (area: string) => (tasksByArea.get(area) ?? 0) + (templateCount.get(area) ?? 0);
  const thinAreas = roleAreas.filter((a) => tasksIn(a.area_key) < MIN_TASKS_PER_AREA).length;
  const skills = career ? [...(skillsOf.get(career.id) ?? [])] : [];
  const thinSkills = skills.filter((s) => (poolBy.get(`${career!.id}:${s}`) ?? 0) < MIN_ASSESS_PER_SKILL).length;
  const learn = Boolean(tpl) && topicCount > 0 && stored / topicCount >= MIN_LESSON_SHARE;
  const practise = roleAreas.length > 0 && thinAreas === 0;
  const prove = Boolean(r.domainRoleKey) && roleEnabled.get(r.domainRoleKey ?? "") === true && skills.length > 0 && thinSkills === 0;
  return {
    id: r.id, role: r.name.slice(0, 34),
    workstation: r.domainRoleKey ? (roleEnabled.get(r.domainRoleKey) ? "live" : "no DB row") : "none",
    roadmap: tpl ? tpl.source : "none", "lessons stored": `${stored}/${topicCount}`,
    "areas (<8 tasks)": `${roleAreas.length} (${thinAreas})`, "skills (thin q)": `${skills.length} (${thinSkills})`,
    L: learn ? "Y" : "-", P: practise ? "Y" : "-", V: prove ? "Y" : "-",
  };
});

const done = (k: "L" | "P" | "V") => roleRows.filter((r) => r[k] === "Y").length;
const full = roleRows.filter((r) => r.L === "Y" && r.P === "Y" && r.V === "Y").length;
const live = roleRows.filter((r) => r.workstation === "live").length;

console.log("\n=== A. Language tracks: lessons, runnable examples and practice ===");
console.table(trackRows);
console.log("=== B. Tier-proof bank (stream/leetcode) ===");
console.table(bankRows);
console.log("=== C. Published Arena bank ===");
console.table(arenaRows);
const emptyAreas = areas.filter((a) => a.enabled && (tasksByArea.get(a.area_key) ?? 0) + (templateCount.get(a.area_key) ?? 0) === 0).map((a) => ({ role: a.role_key, area: a.area_key, tool: a.tool_type ?? "" }));
console.log(`=== D. ${ROLE_CATALOG.length} catalogue roles: Learn / Practise / Prove ===`);
console.table(roleRows);
const summary = [
  `Roles with a live workstation: ${live}/${roleRows.length} (${pct(live, roleRows.length)})`,
  `Learn  (published roadmap and >=${Math.round(MIN_LESSON_SHARE * 100)}% of topics have a stored lesson): ${done("L")}/${roleRows.length}`,
  `Practise (>=1 enabled area, every area has >=${MIN_TASKS_PER_AREA} tasks, counting published rows and code templates): ${done("P")}/${roleRows.length}`,
  `Prove  (live workstation and >=${MIN_ASSESS_PER_SKILL} assessment questions on every required skill): ${done("V")}/${roleRows.length}`,
  `Complete on all three: ${full}/${roleRows.length} (${pct(full, roleRows.length)})`,
];
console.log(`\n${summary.join("\n")}`);
console.log(`\n=== E. Enabled areas with NO task source at all (${emptyAreas.length}) ===`);
if (emptyAreas.length) console.table(emptyAreas);
const notes = [
  `PRACTISE counts published rows plus ${TEMPLATE_REGISTRY.length} templates written in code (lib/arena-workstations/template-registry.ts). A template source missing from that registry would be invisible here: the area list below shows any enabled area that no source covers. A template is a recipe that can generate many tickets, so this counts recipes, not distinct tickets a student can get.`,
  "LEARN: role modules are generated when a student opens a topic and cached (skillstudio_lessons), so almost none are stored ahead of time. That is a finding, not an error: there is no authored, reviewed role curriculum yet.",
  "A 'stored lesson' is one generated and cached, NOT one a person has reviewed: this audit cannot see review, so Learn is an upper bound.",
  "Task counts are published rows, not verified-correct ones: run the role's own verifier for correctness.",
  "A role name that does not match a careers row exactly (before ' / ') shows no roadmap or skills; fix the name or add an alias to count it.",
];
console.log(`\nNotes:\n- ${notes.join("\n- ")}`);

if (process.argv.includes("--md")) {
  const table = (rows: Record<string, unknown>[]) => {
    const heads = Object.keys(rows[0] ?? {});
    return [`| ${heads.join(" | ")} |`, `| ${heads.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${heads.map((h) => String(r[h] ?? "")).join(" | ")} |`)].join("\n");
  };
  const md = ["# Coverage report", `Generated ${new Date().toISOString().slice(0, 10)} by \`npm run coverage:audit -- --md\` (read-only).`, "", "## Summary", ...summary.map((s) => `- ${s}`), "", "## Language tracks", table(trackRows), "", "## Tier-proof bank", table(bankRows), "", "## Published Arena bank", table(arenaRows), "", "## Roles", table(roleRows), "", "## Enabled areas with no task source", emptyAreas.length ? table(emptyAreas) : "None.", "", "## Notes", ...notes.map((n) => `- ${n}`), ""].join("\n");
  writeFileSync("docs/coverage-report.md", md);
  console.log("\nWrote docs/coverage-report.md");
}
