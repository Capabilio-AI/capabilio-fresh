// Read-only readiness report for the launch roles (lib/arena-roles/launch.ts). Usage: npm run arena:gate
// A role is "ready" only when students can be MEASURED (skills + sign-up question bank) and PROVEN (Arena areas linked to those skills).
// Arena itself has no multiple choice: the question bank is the one-off sign-up screen. Scenario-template depth per skill lives in code and is not counted here.
import { createServiceClient } from "@/lib/supabase/service";
import { LAUNCH_ROLES } from "@/lib/arena-roles/launch";

const MIN_SKILLS = 12, MIN_AREAS = 6, MIN_SIGNUP_MCQ = 30;
const db = createServiceClient() as any;

const pool: { career_id: string; skill_id: string }[] = [];
for (let from = 0; ; from += 1000) {
  const { data } = await db.from("assess_question_pool").select("career_id,skill_id").eq("is_active", true).range(from, from + 999);
  pool.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const { data: careers } = await db.from("careers").select("id,key");
const { data: areas } = await db.from("arena_skill_areas").select("role_key,area_key,skill_id,enabled");
const extras: { role_key: string; skill_id: string }[] = (await db.from("arena_area_extra_skills").select("role_key,skill_id")).data ?? []; // empty until migration 149 is applied

const rows = [];
for (const role of LAUNCH_ROLES) {
  const key = role.domainRoleKey;
  const career = key ? careers.find((c: any) => c.key === key) : null;
  const roleAreas = key ? areas.filter((a: any) => a.role_key === key && a.enabled) : [];
  const proves = new Set<string>([...roleAreas.map((a: any) => a.skill_id), ...extras.filter((e: any) => e.role_key === key).map((e: any) => e.skill_id)].filter(Boolean));
  let skills: any[] = [];
  if (career) skills = (await db.from("career_skill_requirements").select("skill_id,importance").eq("career_id", career.id)).data ?? [];
  const mcq = (id: string) => pool.filter((p) => p.career_id === career?.id && p.skill_id === id).length;
  const key2 = skills.filter((s) => s.importance === "CRITICAL" || s.importance === "HIGH");
  const gaps = [
    !key ? "no workstation" : !career ? "no career row" : null,
    skills.length < MIN_SKILLS ? `skills ${skills.length}<${MIN_SKILLS}` : null,
    skills.some((s) => mcq(s.skill_id) < MIN_SIGNUP_MCQ) ? `sign-up MCQ short on ${skills.filter((s) => mcq(s.skill_id) < MIN_SIGNUP_MCQ).length} skills` : null,
    roleAreas.length < MIN_AREAS ? `areas ${roleAreas.length}<${MIN_AREAS}` : null,
    roleAreas.some((a: any) => !a.skill_id) ? `${roleAreas.filter((a: any) => !a.skill_id).length} areas unlinked` : null,
    key2.some((s) => !proves.has(s.skill_id)) ? `${key2.filter((s) => !proves.has(s.skill_id)).length}/${key2.length} critical+high skills unprovable in Arena` : null,
  ].filter(Boolean);
  rows.push({ id: role.id, role: role.name.slice(0, 34), ready: gaps.length === 0 ? "READY" : "-", gaps: gaps.join("; ") });
}
console.table(rows);
console.log(`${rows.filter((r) => r.ready === "READY").length}/${rows.length} launch roles ready`);
