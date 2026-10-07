import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";

type Service = SupabaseClient<Database>;

export const ResourceSpec = z
  .object({
    title: z.string().trim().min(3).max(160),
    provider: z.string().trim().min(2).max(120),
    url: z.string().regex(/^https:\/\/[^\s]+$/, "must be an https link"),
    type: z.enum(["OFFICIAL", "ARTICLE", "VIDEO", "COURSE", "BOOK", "PRACTICE"]),
    tier: z.enum(["FREE", "PREMIUM"]),
    hours: z.number().positive().max(500),
    levelFrom: z.number().int().min(0).max(100),
    levelTo: z.number().int().min(0).max(100),
    skills: z.array(z.string().min(2)).min(1).max(12),
  })
  .strict()
  .refine((r) => r.levelTo >= r.levelFrom, { message: "levelTo must be at least levelFrom" });
export type ResourceSpec = z.infer<typeof ResourceSpec>;

/** Does the link load? A real GET with a timeout; 2xx/3xx passes. Dead links are never imported. */
export async function linkWorks(url: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "CapabilioLinkCheck/1.0" } });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

export interface ResourceReport {
  inserted: number;
  updated: number;
  errors: string[];
}

export async function importResources(service: Service, raw: unknown, check: (url: string) => Promise<boolean> = linkWorks): Promise<ResourceReport> {
  const report: ResourceReport = { inserted: 0, updated: 0, errors: [] };
  const list = (raw as { items?: unknown[] })?.items;
  if (!Array.isArray(list)) return { ...report, errors: ["the file needs an items array"] };
  const specs: ResourceSpec[] = [];
  list.forEach((e, n) => {
    const r = ResourceSpec.safeParse(e);
    if (r.success) specs.push(r.data);
    else report.errors.push(`item ${n + 1}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  });
  const names = [...new Set(specs.flatMap((s) => s.skills))];
  const { data: skills } = await service.from("skills").select("id, name, status").in("name", names);
  const byName = new Map((skills ?? []).map((s) => [s.name, s]));
  for (const n of names) if (byName.get(n)?.status !== "active") report.errors.push(`skill "${n}" is not an active skill`);
  if (report.errors.length) return report;

  const db = untyped(service);
  for (const s of specs) {
    if (!(await check(s.url))) {
      report.errors.push(`${s.title}: the link did not load (${s.url})`);
      continue;
    }
    const row = { title: s.title, provider: s.provider, url: s.url, level_from: s.levelFrom, level_to: s.levelTo, estimated_hours: s.hours, resource_type: s.type, tier: s.tier, is_active: true, link_checked_at: new Date().toISOString() };
    const { data: found } = await db.from("learning_catalog").select("id").eq("url", s.url).maybeSingle();
    let id = (found as { id: string } | null)?.id;
    if (id) {
      const { error } = await db.from("learning_catalog").update(row).eq("id", id);
      if (error) { report.errors.push(`${s.title}: ${error.message}`); continue; }
      report.updated += 1;
    } else {
      const { data: ins, error } = await db.from("learning_catalog").insert(row).select("id").single();
      if (error) { report.errors.push(`${s.title}: ${error.message}`); continue; }
      id = (ins as { id: string }).id;
      report.inserted += 1;
    }
    const { error: linkError } = await db.from("learning_item_skills").upsert(s.skills.map((n) => ({ item_id: id, skill_id: byName.get(n)!.id })), { onConflict: "item_id,skill_id", ignoreDuplicates: true });
    if (linkError) report.errors.push(`${s.title}: ${linkError.message}`);
  }
  return report;
}

const Difficulty = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export const ExtrasSpec = z.object({
  projects: z.array(z.object({ title: z.string().trim().min(5).max(160), difficulty: Difficulty, description: z.string().trim().min(20).max(800), evidence: z.array(z.string().min(3).max(160)).min(1).max(8), skills: z.array(z.string()).min(1).max(8) }).strict()),
  certifications: z.array(z.object({ name: z.string().trim().min(5).max(200), provider: z.string().trim().min(2).max(120), url: z.string().regex(/^https:\/\/[^\s]+$/), difficulty: Difficulty, skills: z.array(z.string()).min(1).max(8) }).strict()),
});

/** Original project briefs and real certifications, each tied to the skills they build. Certification links must load; nothing is overwritten that a person edited (matched by title / link). */
export async function importCareerExtras(service: Service, raw: unknown, check: (url: string) => Promise<boolean> = linkWorks): Promise<ResourceReport> {
  const report: ResourceReport = { inserted: 0, updated: 0, errors: [] };
  const parsed = ExtrasSpec.safeParse(raw);
  if (!parsed.success) return { ...report, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const { projects, certifications } = parsed.data;
  const names = [...new Set([...projects, ...certifications].flatMap((x) => x.skills))];
  const { data: skills } = await service.from("skills").select("id, name, status").in("name", names);
  const byName = new Map((skills ?? []).map((s) => [s.name, s]));
  for (const n of names) if (byName.get(n)?.status !== "active") report.errors.push(`skill "${n}" is not an active skill`);
  if (report.errors.length) return report;
  const db = untyped(service);
  for (const p of projects) {
    const { data: found } = await db.from("project_catalog").select("id").eq("title", p.title).eq("source", "CAPABILIO").maybeSingle();
    let id = (found as { id: string } | null)?.id;
    if (!id) {
      const { data, error } = await db.from("project_catalog").insert({ title: p.title, description: p.description, difficulty: p.difficulty, expected_evidence: p.evidence, source: "CAPABILIO", status: "ACTIVE" }).select("id").single();
      if (error) { report.errors.push(`${p.title}: ${error.message}`); continue; }
      id = (data as { id: string }).id;
      report.inserted += 1;
    } else report.updated += 1;
    const { error } = await db.from("project_skills").upsert(p.skills.map((n) => ({ project_id: id, skill_id: byName.get(n)!.id })), { onConflict: "project_id,skill_id", ignoreDuplicates: true });
    if (error) report.errors.push(`${p.title}: ${error.message}`);
  }
  for (const c of certifications) {
    if (!(await check(c.url))) { report.errors.push(`${c.name}: the link did not load (${c.url})`); continue; }
    const { data: found } = await db.from("certification_catalog").select("id").eq("url", c.url).maybeSingle();
    let id = (found as { id: string } | null)?.id;
    if (!id) {
      const { data, error } = await db.from("certification_catalog").insert({ name: c.name, provider: c.provider, url: c.url, difficulty: c.difficulty, is_active: true }).select("id").single();
      if (error) { report.errors.push(`${c.name}: ${error.message}`); continue; }
      id = (data as { id: string }).id;
      report.inserted += 1;
    } else report.updated += 1;
    const { error } = await db.from("certification_skills").upsert(c.skills.map((n) => ({ certification_id: id, skill_id: byName.get(n)!.id })), { onConflict: "certification_id,skill_id", ignoreDuplicates: true });
    if (error) report.errors.push(`${c.name}: ${error.message}`);
  }
  return report;
}
