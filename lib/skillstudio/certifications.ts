// The certifications on the student's own career roadmap, each with everything needed to decide and to act: where to take it, what it
// costs, what it proves, which roadmap skills it builds (with the student's current level) and free places to learn for it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { loadCareerResources } from "@/lib/roadmap-visual/career-resources";
import { safeUrl } from "@/lib/roadmap-visual/resources";
import { factsFor, type CertFacts } from "./cert-facts";

export interface LearnLink { title: string; provider: string; url: string; hours: number | null }
export interface CertCard {
  id: string;
  title: string;
  provider: string | null;
  /** the provider's own page: where to register */
  url: string | null;
  difficulty: string | null;
  cost: string | null;
  exam: string | null;
  prerequisites: string | null;
  validates: string[];
  skills: { name: string; level: number | null }[];
  learn: LearnLink[];
}
export interface CertSection { which: "primary" | "plan-b"; careerName: string; certs: CertCard[] }

const LEARN_PER_CERT = 3;

export async function loadCertifications(service: SupabaseClient, userId: string): Promise<CertSection[]> {
  const careers = await loadCareerResources(service as never, userId);
  const withCerts = careers.filter((c) => c.certifications.length > 0);
  if (withCerts.length === 0) return [];
  const db = untyped(service);
  const certIds = withCerts.flatMap((c) => c.certifications.map((r) => r.id));

  const [{ data: rows }, { data: links }] = await Promise.all([
    db.from("certification_catalog").select("id, cost, duration, eligibility").in("id", certIds),
    db.from("certification_skills").select("certification_id, skill_id").in("certification_id", certIds),
  ]);
  const catalog = new Map(((rows ?? []) as { id: string; cost: string | null; duration: string | null; eligibility: string | null }[]).map((r) => [r.id, r]));
  const skillIdsOf = new Map<string, string[]>();
  for (const l of (links ?? []) as { certification_id: string; skill_id: string }[]) skillIdsOf.set(l.certification_id, [...(skillIdsOf.get(l.certification_id) ?? []), l.skill_id]);

  // free learning resources for the skills these certifications build
  const allSkillIds = [...new Set([...skillIdsOf.values()].flat())];
  const { data: ls } = allSkillIds.length ? await db.from("learning_item_skills").select("item_id, skill_id").in("skill_id", allSkillIds) : { data: [] };
  const itemIds = [...new Set(((ls ?? []) as { item_id: string }[]).map((r) => r.item_id))];
  const { data: items } = itemIds.length ? await db.from("learning_catalog").select("id, title, provider, url, estimated_hours, tier").in("id", itemIds).eq("is_active", true).eq("tier", "FREE") : { data: [] };
  const itemById = new Map(((items ?? []) as { id: string; title: string; provider: string; url: string | null; estimated_hours: number | string | null }[]).map((i) => [i.id, i]));
  const itemsOfSkill = new Map<string, string[]>();
  for (const l of (ls ?? []) as { item_id: string; skill_id: string }[]) if (itemById.has(l.item_id)) itemsOfSkill.set(l.skill_id, [...(itemsOfSkill.get(l.skill_id) ?? []), l.item_id]);

  // the student's current level per skill name, from the same roadmap graph that powers the Roadmap tab
  const levelOf = await skillLevels(service, userId);

  return withCerts.map((c) => ({
    which: c.which,
    careerName: c.careerName,
    certs: c.certifications.map((r): CertCard => {
      const row = catalog.get(r.id);
      const facts: CertFacts | null = factsFor(r.url);
      const learnIds = [...new Set((skillIdsOf.get(r.id) ?? []).flatMap((s) => itemsOfSkill.get(s) ?? []))].slice(0, LEARN_PER_CERT);
      return {
        id: r.id, title: r.title, provider: r.provider, url: safeUrl(r.url), difficulty: r.difficulty,
        cost: row?.cost ?? facts?.cost ?? null,
        exam: row?.duration ?? facts?.exam ?? null,
        prerequisites: row?.eligibility ?? facts?.prerequisites ?? null,
        validates: facts?.validates ?? [],
        skills: r.skills.map((name) => ({ name, level: levelOf.get(name) ?? null })),
        learn: learnIds.flatMap((id) => { const i = itemById.get(id); const url = i ? safeUrl(i.url) : null; return i && url ? [{ title: i.title, provider: i.provider, url, hours: i.estimated_hours === null ? null : Number(i.estimated_hours) }] : []; }),
      };
    }),
  }));
}

async function skillLevels(service: SupabaseClient, userId: string): Promise<Map<string, number | null>> {
  const { getRoadmapGraph } = await import("@/lib/roadmap-visual/service");
  const res = await getRoadmapGraph(service as never, userId, "primary").catch(() => null);
  const out = new Map<string, number | null>();
  if (res?.ok) for (const n of res.graph.nodes) if (n.type === "TOPIC" && !n.resource && n.skill) out.set(n.skill.name, n.level);
  return out;
}
