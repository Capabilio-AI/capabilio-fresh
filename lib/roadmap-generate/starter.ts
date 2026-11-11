import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { importTemplate } from "@/lib/roadmap-visual/template-store";
import type { TemplateSpec } from "@/lib/roadmap-visual/template-spec";
import { slug } from "./normalize";

type Service = SupabaseClient<Database>;
type Stage = "FOUNDATION" | "CORE" | "SPECIALIZATION" | "JOB_READY";

/** How a starter roadmap is recognised later: the full AI roadmap replaces it, and the daily refresh treats it as "not built yet". */
export const STARTER_METHOD = "Built automatically from the role's skill profile so the student has a roadmap straight away. It is replaced by the full AI-generated roadmap once that is ready.";
export const isStarterProvenance = (p: unknown): boolean => typeof (p as { method?: unknown } | null)?.method === "string" && (p as { method: string }).method === STARTER_METHOD;

export interface StarterSkill { name: string; category: string | null; description: string | null; importance: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; targetLevel: number }

const RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
const STAGES: Stage[] = ["FOUNDATION", "CORE", "SPECIALIZATION", "JOB_READY"];
const STAGE_TEXT: Record<Stage, string> = {
  FOUNDATION: "The basics this role is built on. Start here.",
  CORE: "The core skills employers expect in this role.",
  SPECIALIZATION: "Deeper skills that set a strong candidate apart.",
  JOB_READY: "The finishing skills that make you ready to be hired.",
};
const TOPIC_IMPORTANCE = { CRITICAL: "CORE", HIGH: "CORE", MEDIUM: "RECOMMENDED", LOW: "OPTIONAL" } as const;

/** Pure. Which stage each skill lands in: most important first, so the critical skills open the roadmap and the optional ones close it. */
function stagesFor(count: number): Stage[] {
  return Array.from({ length: count }, (_, i) => STAGES[Math.min(3, Math.floor((i / Math.max(1, count)) * 4))]);
}

/**
 * Pure. A complete, valid roadmap for a role straight from its skill profile, with no AI: four stages, topic groups by skill category, one
 * topic per skill carrying the skill's importance and target. It is plain on purpose (no prerequisites, no projects) and is meant to be
 * replaced by the full roadmap; its job is that no student is ever left without one.
 */
export function buildStarterSpec(input: { careerKey: string; careerName: string; version: number; skills: StarterSkill[] }): TemplateSpec {
  const ordered = [...input.skills].sort((a, b) => RANK[a.importance] - RANK[b.importance] || a.name.localeCompare(b.name));
  const stage = stagesFor(ordered.length);
  const used = stage.reduce<Stage[]>((acc, s) => (acc.includes(s) ? acc : [...acc, s]), []);

  const nodes: TemplateSpec["nodes"] = used.map((s, i) => ({
    key: `stage-${s.toLowerCase().replace("_", "-")}`, parent: null, type: "SPINE" as const, title: { FOUNDATION: "Foundation", CORE: "Core", SPECIALIZATION: "Specialization", JOB_READY: "Job ready" }[s],
    description: STAGE_TEXT[s], skill: null, importance: "CORE" as const, target: null, stage: s, side: "CENTER" as const, order: i + 1,
  }));

  const groups = new Map<string, "LEFT" | "RIGHT">();
  let side: "LEFT" | "RIGHT" = "LEFT";
  let order = 1;
  ordered.forEach((sk, i) => {
    const st = stage[i];
    const category = sk.category?.trim() || "Other skills";
    const groupKey = `${st.toLowerCase().replace("_", "-")}-${slug(category) || "other"}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, side);
      nodes.push({
        key: groupKey, parent: `stage-${st.toLowerCase().replace("_", "-")}`, type: "GROUP", title: category.slice(0, 120), description: `${category} skills for the ${input.careerName} role.`,
        skill: null, importance: "CORE", target: null, stage: st, side, order: order++,
      });
      side = side === "LEFT" ? "RIGHT" : "LEFT";
    }
    nodes.push({
      key: slug(sk.name) || `skill-${i}`, parent: groupKey, type: "TOPIC", title: sk.name.slice(0, 120),
      description: (sk.description?.trim().length ?? 0) >= 10 ? sk.description!.trim().slice(0, 1200) : `Learn ${sk.name} and use it the way a ${input.careerName} does.`,
      skill: sk.name, importance: TOPIC_IMPORTANCE[sk.importance], target: sk.targetLevel, stage: st, side: groups.get(groupKey)!, order: order++,
    });
  });

  return {
    career: input.careerKey, version: input.version, title: `${input.careerName}: starter roadmap`,
    description: `The skills a ${input.careerName} needs, in the order to learn them. A fuller roadmap with projects and certifications replaces this one when it is ready.`,
    provenance: { designedBy: "Capabilio (from the role's skill profile)", method: STARTER_METHOD },
    nodes, edges: [],
  };
}

/** True when the career's published roadmap is a starter, which the full roadmap should replace. */
export async function starterPublished(service: Service, careerId: string): Promise<boolean> {
  const { data } = await untyped(service).from("roadmap_templates").select("provenance").eq("career_id", careerId).eq("status", "PUBLISHED").maybeSingle();
  return isStarterProvenance((data as { provenance?: unknown } | null)?.provenance);
}

/**
 * Gives a career with no published roadmap a starter one, built instantly from its skill profile. Never replaces a roadmap that exists.
 * Returns true when it published one. Safe to call from anywhere and to race: a loser of the race finds the roadmap already there.
 */
export async function ensureStarterRoadmap(service: Service, careerId: string): Promise<boolean> {
  const db = untyped(service);
  const { data: existing } = await db.from("roadmap_templates").select("id").eq("career_id", careerId).eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(1);
  if (((existing ?? []) as unknown[]).length > 0) return false;

  const [{ data: career }, { data: reqs }, { data: versions }] = await Promise.all([
    service.from("careers").select("key, name").eq("id", careerId).eq("is_active", true).maybeSingle(),
    db.from("career_skill_requirements").select("importance, target_level, skills!inner(name, category, description, status)").eq("career_id", careerId),
    db.from("roadmap_templates").select("version").eq("career_id", careerId).order("version", { ascending: false }).limit(1),
  ]);
  if (!career) return false;
  type Req = { importance: StarterSkill["importance"]; target_level: number; skills: { name: string; category: string | null; description: string | null; status: string } };
  const skills: StarterSkill[] = ((reqs ?? []) as unknown as Req[]).filter((r) => r.skills.status === "active").map((r) => ({ name: r.skills.name, category: r.skills.category, description: r.skills.description, importance: r.importance, targetLevel: r.target_level }));
  if (skills.length < 3) return false;

  const version = (((versions ?? []) as { version: number }[])[0]?.version ?? 0) + 1;
  try {
    const saved = await importTemplate(service, buildStarterSpec({ careerKey: career.key, careerName: career.name, version, skills }));
    const { error } = await db.from("roadmap_templates").update({ status: "PUBLISHED", source: "AI_GENERATED", reviewed_by: null, reviewed_at: null, published_at: new Date().toISOString() }).eq("id", saved.id);
    if (error) throw error;
    return true;
  } catch (e) {
    // another request built it first, or the skills changed under us: either way the caller re-reads
    console.error("[roadmap-starter]", careerId, e instanceof Error ? e.message : e);
    return false;
  }
}
