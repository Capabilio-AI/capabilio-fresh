import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import type { RoleRow } from "./find";

type Service = SupabaseClient;
const PAGE = 1000;

/** Every row of a query, a page at a time: the database returns at most 1000 rows per request and the topics of all roles are more than that. */
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Active roles that have a published roadmap, each with the titles of its topics. A read that fails throws: it must never look like "no roles". */
export async function loadRoleRows(service: Service): Promise<RoleRow[]> {
  const db = untyped(service);
  const [careers, templates] = await Promise.all([
    db.from("careers").select("id, key, name, category, description").eq("is_active", true),
    db.from("roadmap_templates").select("id, career_id").eq("status", "PUBLISHED"),
  ]);
  if (careers.error) throw new Error(`could not read roles: ${careers.error.message}`);
  if (templates.error) throw new Error(`could not read roadmaps: ${templates.error.message}`);
  const templateOf = new Map(((templates.data ?? []) as { id: string; career_id: string }[]).map((t) => [t.id, t.career_id]));
  const nodes = await allRows<{ template_id: string; title: string; stage: string }>((from, to) =>
    db.from("roadmap_nodes").select("template_id, title, stage").eq("type", "TOPIC").in("template_id", [...templateOf.keys()]).order("id").range(from, to));
  const topicsOf = new Map<string, { title: string; stage: string }[]>();
  for (const n of nodes) {
    const career = templateOf.get(n.template_id);
    if (career) topicsOf.set(career, [...(topicsOf.get(career) ?? []), { title: n.title, stage: n.stage }]);
  }
  const hasRoadmap = new Set(templateOf.values());
  return ((careers.data ?? []) as { id: string; key: string; name: string; category: string; description: string | null }[])
    .filter((c) => hasRoadmap.has(c.id))
    .map((c) => ({ key: c.key, name: c.name, category: c.category, description: c.description, topics: topicsOf.get(c.id) ?? [] }));
}

export interface RoleRoadmap {
  role: { key: string; name: string; category: string; description: string | null };
  /** the role's topics in the order the roadmap lists them */
  topics: { title: string; description: string | null; stage: string }[];
}

/** One role's published roadmap, or null when the role does not exist or has none. */
export async function loadRoleRoadmap(service: Service, roleKey: string): Promise<RoleRoadmap | null> {
  const db = untyped(service);
  const career = await db.from("careers").select("id, key, name, category, description").eq("key", roleKey).eq("is_active", true).maybeSingle();
  if (career.error) throw new Error(`could not read the role: ${career.error.message}`);
  const c = career.data as { id: string; key: string; name: string; category: string; description: string | null } | null;
  if (!c) return null;
  const template = await db.from("roadmap_templates").select("id").eq("career_id", c.id).eq("status", "PUBLISHED").order("version", { ascending: false }).limit(1).maybeSingle();
  if (template.error) throw new Error(`could not read the roadmap: ${template.error.message}`);
  const t = template.data as { id: string } | null;
  if (!t) return null;
  const nodes = await allRows<{ title: string; description: string | null; stage: string }>((from, to) =>
    db.from("roadmap_nodes").select("title, description, stage").eq("template_id", t.id).eq("type", "TOPIC").order("sort_order").range(from, to));
  return { role: { key: c.key, name: c.name, category: c.category, description: c.description }, topics: nodes };
}
