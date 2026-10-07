import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { buildKeywords, EMPTY_CONTEXT, type CareerContext } from "./relevance";

type Service = SupabaseClient<Database>;
const SKILLS_PER_CAREER = 12;
const IMPORTANCE_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

interface CareerRow {
  id: string;
  name: string;
}

/** The person's career goal(s) and the vocabulary around them, for ranking the feed. A stated free-text goal is the fallback. */
export async function loadCareerContext(service: Service, userId: string): Promise<CareerContext> {
  const db = untyped(service);
  const { data: intent } = await db.from("student_career_intent").select("primary_career_id, secondary_career_id").eq("student_id", userId).maybeSingle();
  const ids = [intent?.primary_career_id, intent?.secondary_career_id].filter((x): x is string => Boolean(x));
  if (ids.length === 0) {
    const { data: stated } = await service.from("career_interest_target").select("stated_role").eq("user_id", userId).maybeSingle();
    const role = stated?.stated_role?.trim();
    return role ? { roles: [role], keywords: buildKeywords([role], []) } : EMPTY_CONTEXT;
  }
  const [{ data: careers }, { data: reqs }] = await Promise.all([
    db.from("careers").select("id, name").in("id", ids),
    db.from("career_skill_requirements").select("career_id, skill_id, importance").in("career_id", ids),
  ]);
  const requirements = (reqs ?? []) as { career_id: string; skill_id: string; importance: string }[];
  const top = ids.flatMap((id) => requirements.filter((r) => r.career_id === id).sort((a, b) => (IMPORTANCE_RANK[a.importance] ?? 9) - (IMPORTANCE_RANK[b.importance] ?? 9)).slice(0, SKILLS_PER_CAREER));
  const { data: skills } = top.length ? await service.from("skills").select("id, name").in("id", [...new Set(top.map((t) => t.skill_id))]) : { data: [] };
  const skillName = new Map((skills ?? []).map((s) => [s.id, s.name]));
  const byId = new Map(((careers ?? []) as CareerRow[]).map((c) => [c.id, c.name]));
  const roles = ids.map((id) => byId.get(id)).filter((n): n is string => Boolean(n));
  return { roles, keywords: buildKeywords(roles, top.map((t) => skillName.get(t.skill_id) ?? "").filter(Boolean)) };
}

/** The career goal each person has chosen to show on Pulse ("AI/ML Engineer"), for people who haven't hidden it or are still exploring. */
export async function loadAspirations(service: Service, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const db = untyped(service);
  const [{ data: intents }, { data: visible }] = await Promise.all([
    db.from("student_career_intent").select("student_id, primary_career_id, is_exploring").in("student_id", userIds).not("primary_career_id", "is", null),
    db.from("profiles").select("id, pulse_show_career").in("id", userIds),
  ]);
  const shown = new Set(((visible ?? []) as { id: string; pulse_show_career: boolean }[]).filter((p) => p.pulse_show_career).map((p) => p.id));
  const rows = ((intents ?? []) as { student_id: string; primary_career_id: string; is_exploring: boolean }[]).filter((r) => shown.has(r.student_id) && !r.is_exploring);
  if (rows.length === 0) return new Map();
  const { data: careers } = await db.from("careers").select("id, name").in("id", [...new Set(rows.map((r) => r.primary_career_id))]);
  const name = new Map(((careers ?? []) as CareerRow[]).map((c) => [c.id, c.name]));
  return new Map(rows.flatMap((r) => (name.has(r.primary_career_id) ? [[r.student_id, name.get(r.primary_career_id) as string] as const] : [])));
}
