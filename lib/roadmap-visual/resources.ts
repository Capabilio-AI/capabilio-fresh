import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import type { Resource, ResourcePool, ResourceType } from "./graph-types";

type Service = SupabaseClient<Database>;

/** Pure. Only https links leave the building as external links; anything else is dropped rather than shown. */
export const safeUrl = (url: string | null): string | null => (url && /^https:\/\/[^\s]+$/.test(url) ? url : null);

const add = (m: Map<string, Resource[]>, key: string, r: Resource) => m.set(key, [...(m.get(key) ?? []), r]);

/**
 * Everything configured for the given skills and nodes: learning resources (free/premium, typed), certifications, projects a student may be offered,
 * and published Arena challenges. Only items that exist in the catalogs; nothing is ever invented, and a topic with none says so.
 */
export async function loadResourcePool(service: Service, ctx: { skillIds: string[]; nodeIds: Map<string, string>; studentId: string; institutionId: string | null }): Promise<ResourcePool> {
  const db = untyped(service);
  const bySkill = new Map<string, Resource[]>();
  const byNode = new Map<string, Resource[]>();
  if (ctx.skillIds.length === 0) return { bySkill, byNode };

  const [{ data: ls }, { data: cs }, { data: ps }, { data: as }, { data: nr }] = await Promise.all([
    db.from("learning_item_skills").select("item_id, skill_id").in("skill_id", ctx.skillIds),
    db.from("certification_skills").select("certification_id, skill_id").in("skill_id", ctx.skillIds),
    db.from("project_skills").select("project_id, skill_id").in("skill_id", ctx.skillIds),
    db.from("arena_challenge_skills").select("challenge_id, skill_id").in("skill_id", ctx.skillIds),
    db.from("node_resources").select("node_id, resource_kind, resource_id, tier").in("node_id", [...ctx.nodeIds.values()]),
  ]);
  const ids = (rows: { [k: string]: string }[] | null, key: string) => [...new Set((rows ?? []).map((r) => r[key]))];
  const nodeRows = (nr ?? []) as { node_id: string; resource_kind: Resource["kind"]; resource_id: string; tier: "FREE" | "PREMIUM" }[];
  const learningIds = [...new Set([...ids(ls, "item_id"), ...nodeRows.filter((r) => r.resource_kind === "LEARNING").map((r) => r.resource_id)])];
  const certIds = [...new Set([...ids(cs, "certification_id"), ...nodeRows.filter((r) => r.resource_kind === "CERTIFICATION").map((r) => r.resource_id)])];
  const projectIds = [...new Set([...ids(ps, "project_id"), ...nodeRows.filter((r) => r.resource_kind === "PROJECT").map((r) => r.resource_id)])];
  const arenaIds = [...new Set([...ids(as, "challenge_id"), ...nodeRows.filter((r) => r.resource_kind === "ARENA").map((r) => r.resource_id)])];

  const [{ data: learning }, { data: certs }, { data: projects }, { data: arena }] = await Promise.all([
    learningIds.length ? db.from("learning_catalog").select("id, title, provider, url, estimated_hours, resource_type, tier").in("id", learningIds).eq("is_active", true) : { data: [] },
    certIds.length ? db.from("certification_catalog").select("id, name, provider, url, cost, duration, difficulty, eligibility").in("id", certIds).eq("is_active", true) : { data: [] },
    projectIds.length ? db.from("project_catalog").select("id, title, description, difficulty, expected_evidence, source, status, institution_id, for_student_id").in("id", projectIds) : { data: [] },
    arenaIds.length ? db.from("arena_challenges").select("id, title, difficulty, track").in("id", arenaIds).eq("status", "PUBLISHED").is("user_id", null) : { data: [] },
  ]);

  const make = new Map<string, Resource>();
  for (const l of (learning ?? []) as { id: string; title: string; provider: string; url: string | null; estimated_hours: number | string | null; resource_type: ResourceType | null; tier: "FREE" | "PREMIUM" }[])
    make.set(`LEARNING:${l.id}`, { id: l.id, kind: "LEARNING", title: l.title, provider: l.provider, url: safeUrl(l.url), type: l.resource_type, tier: l.tier, difficulty: null, hours: l.estimated_hours === null ? null : Number(l.estimated_hours), cost: null, note: null, description: null, evidence: [], skills: [] });
  for (const c of (certs ?? []) as { id: string; name: string; provider: string; url: string | null; cost: string | null; duration: string | null; difficulty: string | null; eligibility: string | null }[])
    make.set(`CERTIFICATION:${c.id}`, { id: c.id, kind: "CERTIFICATION", title: c.name, provider: c.provider, url: safeUrl(c.url), type: null, tier: "PREMIUM", difficulty: c.difficulty, hours: null, cost: c.cost, note: c.duration, description: c.eligibility ? `Eligibility: ${c.eligibility}` : null, evidence: [], skills: [] });
  for (const p of (projects ?? []) as { id: string; title: string; description: string; difficulty: string; expected_evidence: string[] | null; source: string; status: string; institution_id: string | null; for_student_id: string | null }[]) {
    // a student is only offered live general projects, their own college's, and recommendations made for them
    const ok = (p.status === "ACTIVE" && (p.source === "CAPABILIO" || p.source === "AI_CAREER" || p.source === "MENTOR" || (p.source === "COLLEGE" && p.institution_id === ctx.institutionId))) || (p.status === "RECOMMENDATION" && p.for_student_id === ctx.studentId);
    if (ok) make.set(`PROJECT:${p.id}`, { id: p.id, kind: "PROJECT", title: p.title, provider: null, url: "/arena/projects", type: null, tier: "FREE", difficulty: p.difficulty, hours: null, cost: null, note: p.description.slice(0, 160), description: p.description, evidence: p.expected_evidence ?? [], skills: [] });
  }
  for (const a of (arena ?? []) as { id: string; title: string; difficulty: string; track: string }[])
    make.set(`ARENA:${a.id}`, { id: a.id, kind: "ARENA", title: a.title, provider: "Capabilio Arena", url: a.track === "domain" ? "/arena/challenges/domain" : "/arena/challenges/stream", type: null, tier: "FREE", difficulty: a.difficulty, hours: null, cost: null, note: null, description: null, evidence: [], skills: [] });

  const link = (rows: { [k: string]: string }[] | null, kind: Resource["kind"], resourceKey: string) => {
    for (const r of rows ?? []) {
      const res = make.get(`${kind}:${r[resourceKey]}`);
      if (res) add(bySkill, r.skill_id, res);
    }
  };
  const { data: skillRows } = await service.from("skills").select("id, name").in("id", ctx.skillIds);
  const skillName = new Map((skillRows ?? []).map((x) => [x.id, x.name]));
  const learnSkill = (rows: { [k: string]: string }[] | null, kind: Resource["kind"], resourceKey: string) => {
    for (const r of rows ?? []) {
      const res = make.get(`${kind}:${r[resourceKey]}`);
      const n = skillName.get(r.skill_id);
      if (res && n && !res.skills.includes(n)) res.skills.push(n);
    }
  };
  for (const [rows, kind, key] of [[ls, "LEARNING", "item_id"], [cs, "CERTIFICATION", "certification_id"], [ps, "PROJECT", "project_id"], [as, "ARENA", "challenge_id"]] as const) learnSkill(rows, kind, key);
  link(ls, "LEARNING", "item_id");
  link(cs, "CERTIFICATION", "certification_id");
  link(ps, "PROJECT", "project_id");
  link(as, "ARENA", "challenge_id");
  const keyOfNode = new Map([...ctx.nodeIds].map(([key, id]) => [id, key]));
  for (const r of nodeRows) {
    const res = make.get(`${r.resource_kind}:${r.resource_id}`);
    const key = keyOfNode.get(r.node_id);
    if (res && key) add(byNode, key, r.resource_kind === "LEARNING" ? { ...res, tier: r.tier } : res);
  }
  return { bySkill, byNode };
}
