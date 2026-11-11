// Read-only report: for EVERY active career, is there a skill profile, a published roadmap, projects, and assessment questions?
// Usage: npm run roles:coverage            (summary + the roles with gaps)
//        npm run roles:coverage -- --all   (every role)
// Writes nothing. "Roadmap" counts only a PUBLISHED template; "projects" are ACTIVE catalogue projects that teach at least one of the role's skills.
import { createServiceClient } from "@/lib/supabase/service";

const db = createServiceClient() as any;
const showAll = process.argv.includes("--all");
const MIN_SKILLS = 8;
const MIN_PROJECTS = 3;
const MIN_QUESTIONS_PER_SKILL = 6;

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

const [careers, requirements, templates, projectSkills, projects, pool] = await Promise.all([
  all<{ id: string; key: string; name: string; status: string | null }>("careers", "id,key,name,status", (q) => q.eq("is_active", true)),
  all<{ career_id: string; skill_id: string }>("career_skill_requirements", "career_id,skill_id"),
  all<{ career_id: string; status: string; source: string }>("roadmap_templates", "career_id,status,source", (q) => q.eq("status", "PUBLISHED")),
  all<{ project_id: string; skill_id: string }>("project_skills", "project_id,skill_id"),
  all<{ id: string }>("project_catalog", "id", (q) => q.eq("status", "ACTIVE")),
  all<{ career_id: string; skill_id: string }>("assess_question_pool", "career_id,skill_id", (q) => q.eq("is_active", true)),
]);

const activeProjects = new Set(projects.map((p) => p.id));
const skillsOf = new Map<string, Set<string>>();
for (const r of requirements) skillsOf.set(r.career_id, (skillsOf.get(r.career_id) ?? new Set()).add(r.skill_id));
const roadmapOf = new Map(templates.map((t) => [t.career_id, t.source]));
const projectsBySkill = new Map<string, Set<string>>();
for (const p of projectSkills) if (activeProjects.has(p.project_id)) projectsBySkill.set(p.skill_id, (projectsBySkill.get(p.skill_id) ?? new Set()).add(p.project_id));
const questions = new Map<string, number>();
for (const q of pool) questions.set(`${q.career_id}:${q.skill_id}`, (questions.get(`${q.career_id}:${q.skill_id}`) ?? 0) + 1);

const rows = careers.map((c) => {
  const skills = [...(skillsOf.get(c.id) ?? [])];
  const projectIds = new Set(skills.flatMap((s) => [...(projectsBySkill.get(s) ?? [])]));
  const thin = skills.filter((s) => (questions.get(`${c.id}:${s}`) ?? 0) < MIN_QUESTIONS_PER_SKILL).length;
  const gaps = [
    skills.length < MIN_SKILLS ? `skills ${skills.length}<${MIN_SKILLS}` : null,
    !roadmapOf.has(c.id) ? "no published roadmap" : null,
    projectIds.size < MIN_PROJECTS ? `projects ${projectIds.size}<${MIN_PROJECTS}` : null,
    skills.length > 0 && thin > 0 ? `questions thin on ${thin}/${skills.length} skills` : null,
  ].filter(Boolean) as string[];
  return { role: c.name.slice(0, 40), origin: c.status ?? "CURATED", skills: skills.length, roadmap: roadmapOf.get(c.id) ?? "-", projects: projectIds.size, thinSkills: thin, gaps: gaps.join("; ") };
});

const complete = rows.filter((r) => r.gaps === "");
console.table(showAll ? rows : rows.filter((r) => r.gaps !== ""));
const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
console.log(`\n${rows.length} active roles`);
console.log(`  complete (skills + roadmap + projects + questions): ${complete.length}`);
console.log(`  no skill profile / too few skills: ${count((r) => r.skills < MIN_SKILLS)}`);
console.log(`  no published roadmap:              ${count((r) => r.roadmap === "-")}`);
console.log(`  too few projects:                  ${count((r) => r.projects < MIN_PROJECTS)}`);
console.log(`  thin assessment questions:         ${count((r) => r.thinSkills > 0 && r.skills > 0)}`);
console.log(`  roadmaps by source:`, Object.fromEntries([...new Set(templates.map((t) => t.source))].map((s) => [s, templates.filter((t) => t.source === s).length])));
