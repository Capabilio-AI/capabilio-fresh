import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { ContentError } from "@/lib/arena-content/store";
import { templateHash, TemplateSpecSchema, validateTemplateSpec, type TemplateReference, type TemplateSpec } from "./template-spec";

type Service = SupabaseClient<Database>;
export type TemplateStatus = "DRAFT" | "REVIEWED" | "PUBLISHED" | "RETIRED";

export async function loadTemplateReference(service: Service): Promise<TemplateReference & { careerNames: Map<string, string> }> {
  const [{ data: skills }, { data: careers }] = await Promise.all([service.from("skills").select("name, status"), service.from("careers").select("id, key, name").eq("is_active", true)]);
  return {
    skills: { statusByName: new Map((skills ?? []).map((s) => [s.name, s.status as "active" | "candidate" | "deprecated"])) },
    careers: new Map((careers ?? []).map((c) => [c.key, c.id])),
    careerNames: new Map((careers ?? []).map((c) => [c.key, c.name])),
  };
}

interface NodeRow {
  id: string;
  node_key: string;
  parent_node_id: string | null;
  type: "SPINE" | "GROUP" | "TOPIC";
  title: string;
  description: string | null;
  skill_id: string | null;
  importance: "CORE" | "RECOMMENDED" | "OPTIONAL";
  target_level: number | null;
  stage: "FOUNDATION" | "CORE" | "SPECIALIZATION" | "JOB_READY";
  sort_order: number;
  side: "LEFT" | "RIGHT" | "CENTER";
}

/**
 * Writes a validated spec as a DRAFT template (creating or replacing the same career + version while it is still a draft/reviewed one).
 * A PUBLISHED or retired version is never rewritten: a change is a new version number. Any change clears review.
 */
export async function importTemplate(service: Service, input: unknown): Promise<{ id: string; created: boolean; changed: boolean }> {
  const ref = await loadTemplateReference(service);
  const v = validateTemplateSpec(input, ref);
  if (!v.ok || !v.spec) throw new ContentError(v.errors.join("; "));
  const spec = v.spec;
  const db = untyped(service);
  const careerId = ref.careers.get(spec.career)!;
  const hash = templateHash(spec);

  const { data: existing } = await db.from("roadmap_templates").select("id, status, spec_hash").eq("career_id", careerId).eq("version", spec.version).maybeSingle();
  if (existing && (existing.status === "PUBLISHED" || existing.status === "RETIRED")) throw new ContentError(`Version ${spec.version} is ${existing.status.toLowerCase()} and cannot be changed. Import it as version ${spec.version + 1}.`, 409);
  if (existing?.spec_hash === hash && existing.status === "DRAFT") return { id: existing.id, created: false, changed: false };

  const { data: skills } = await service.from("skills").select("id, name").in("name", spec.nodes.flatMap((n) => (n.skill ? [n.skill] : [])));
  const skillId = new Map((skills ?? []).map((s) => [s.name, s.id]));

  const header = { career_id: careerId, version: spec.version, title: spec.title, description: spec.description ?? null, provenance: spec.provenance, spec_hash: hash, status: "DRAFT", source: "CAPABILIO", reviewed_by: null, reviewed_at: null, published_at: null };
  const saved = existing ? await db.from("roadmap_templates").update(header).eq("id", existing.id).select("id").single() : await db.from("roadmap_templates").insert(header).select("id").single();
  if (saved.error) throw saved.error;
  const templateId = saved.data.id as string;
  if (existing) await db.from("roadmap_nodes").delete().eq("template_id", templateId); // edges and resources cascade

  // parents before children, so each node's parent id is known
  const idByKey = new Map<string, string>();
  for (const type of ["SPINE", "GROUP", "TOPIC"] as const) {
    const rows = spec.nodes.filter((n) => n.type === type).map((n) => ({
      template_id: templateId, node_key: n.key, parent_node_id: n.parent ? idByKey.get(n.parent) ?? null : null, type: n.type, title: n.title, description: n.description,
      skill_id: n.skill ? skillId.get(n.skill) ?? null : null, importance: n.importance, target_level: n.target, stage: n.stage, sort_order: n.order, side: n.side,
    }));
    if (rows.length === 0) continue;
    const { data, error } = await db.from("roadmap_nodes").insert(rows).select("id, node_key");
    if (error) throw error;
    for (const r of (data ?? []) as { id: string; node_key: string }[]) idByKey.set(r.node_key, r.id);
  }
  if (spec.edges.length) {
    const { error } = await db.from("roadmap_edges").insert(spec.edges.map((e) => ({ template_id: templateId, from_node_id: idByKey.get(e.from), to_node_id: idByKey.get(e.to), type: e.type })));
    if (error) throw error;
  }
  return { id: templateId, created: !existing, changed: true };
}

/** Rebuilds the authored spec from the stored rows (for editing and for checking nothing was changed outside the pipeline). */
export async function exportTemplate(service: Service, templateId: string): Promise<{ spec: TemplateSpec; status: TemplateStatus; storedHash: string | null }> {
  const db = untyped(service);
  const { data: t } = await db.from("roadmap_templates").select("id, career_id, version, title, description, provenance, status, spec_hash").eq("id", templateId).maybeSingle();
  if (!t) throw new ContentError("Template not found.", 404);
  const [{ data: nodes }, { data: edges }, { data: career }] = await Promise.all([
    db.from("roadmap_nodes").select("id, node_key, parent_node_id, type, title, description, skill_id, importance, target_level, stage, sort_order, side").eq("template_id", templateId),
    db.from("roadmap_edges").select("from_node_id, to_node_id, type").eq("template_id", templateId),
    service.from("careers").select("key").eq("id", t.career_id).single(),
  ]);
  const rows = (nodes ?? []) as NodeRow[];
  const keyOf = new Map(rows.map((n) => [n.id, n.node_key]));
  const skillIds = rows.flatMap((n) => (n.skill_id ? [n.skill_id] : []));
  const { data: skills } = skillIds.length ? await service.from("skills").select("id, name").in("id", skillIds) : { data: [] };
  const nameOf = new Map((skills ?? []).map((s) => [s.id, s.name]));
  const spec = TemplateSpecSchema.parse({
    career: career?.key, version: t.version, title: t.title, ...(t.description ? { description: t.description } : {}), provenance: t.provenance,
    nodes: rows
      .sort((a, b) => a.sort_order - b.sort_order || a.node_key.localeCompare(b.node_key))
      .map((n) => ({ key: n.node_key, parent: n.parent_node_id ? keyOf.get(n.parent_node_id) ?? null : null, type: n.type, title: n.title, description: n.description ?? "(no description)", skill: n.skill_id ? nameOf.get(n.skill_id) ?? null : null, importance: n.importance, target: n.target_level, stage: n.stage, side: n.side, order: n.sort_order })),
    edges: ((edges ?? []) as { from_node_id: string; to_node_id: string; type: "PREREQUISITE" | "CONNECTOR" | "OPTIONAL_PATH" }[]).map((e) => ({ from: keyOf.get(e.from_node_id)!, to: keyOf.get(e.to_node_id)!, type: e.type })),
  });
  return { spec, status: t.status, storedHash: t.spec_hash };
}

async function head(service: Service, id: string) {
  const { data } = await untyped(service).from("roadmap_templates").select("id, career_id, status, spec_hash, version").eq("id", id).maybeSingle();
  if (!data) throw new ContentError("Template not found.", 404);
  return data as { id: string; career_id: string; status: TemplateStatus; spec_hash: string | null; version: number };
}

/** A person reviews a DRAFT. The stored tree must still be exactly what was imported and validated. */
export async function reviewTemplate(service: Service, id: string, adminId: string): Promise<void> {
  const t = await head(service, id);
  if (t.status !== "DRAFT") throw new ContentError("Only a draft can be reviewed.", 409);
  const ref = await loadTemplateReference(service);
  const { spec, storedHash } = await exportTemplate(service, id);
  const v = validateTemplateSpec(spec, ref);
  if (!v.ok) throw new ContentError(`It no longer validates: ${v.errors.join("; ")}`, 409);
  if (storedHash && storedHash !== templateHash(spec)) throw new ContentError("The stored tree differs from what was imported; import it again.", 409);
  const { error } = await untyped(service).from("roadmap_templates").update({ status: "REVIEWED", reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** REVIEWED -> PUBLISHED; the career's previously published version (if any) is retired in the same step. */
export async function publishTemplate(service: Service, id: string): Promise<void> {
  const t = await head(service, id);
  if (t.status === "PUBLISHED") return;
  if (t.status !== "REVIEWED") throw new ContentError("A template must be reviewed before it is published.", 409);
  const db = untyped(service);
  await db.from("roadmap_templates").update({ status: "RETIRED" }).eq("career_id", t.career_id).eq("status", "PUBLISHED");
  const { error } = await db.from("roadmap_templates").update({ status: "PUBLISHED", published_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function retireTemplate(service: Service, id: string): Promise<void> {
  await head(service, id);
  const { error } = await untyped(service).from("roadmap_templates").update({ status: "RETIRED" }).eq("id", id);
  if (error) throw error;
}

export interface TemplateListItem {
  id: string;
  career: string;
  careerKey: string;
  version: number;
  status: TemplateStatus;
  title: string;
  topics: number;
  reviewedAt: string | null;
  publishedAt: string | null;
}

export async function listTemplates(service: Service): Promise<TemplateListItem[]> {
  const db = untyped(service);
  const [{ data: ts }, { data: careers }, { data: nodes }] = await Promise.all([
    db.from("roadmap_templates").select("id, career_id, version, status, title, reviewed_at, published_at").order("created_at", { ascending: false }),
    service.from("careers").select("id, key, name"),
    db.from("roadmap_nodes").select("template_id").eq("type", "TOPIC"),
  ]);
  const career = new Map((careers ?? []).map((c) => [c.id, c]));
  const topics = new Map<string, number>();
  for (const n of (nodes ?? []) as { template_id: string }[]) topics.set(n.template_id, (topics.get(n.template_id) ?? 0) + 1);
  return ((ts ?? []) as { id: string; career_id: string; version: number; status: TemplateStatus; title: string; reviewed_at: string | null; published_at: string | null }[]).map((t) => ({
    id: t.id, career: career.get(t.career_id)?.name ?? "?", careerKey: career.get(t.career_id)?.key ?? "?", version: t.version, status: t.status, title: t.title, topics: topics.get(t.id) ?? 0, reviewedAt: t.reviewed_at, publishedAt: t.published_at,
  }));
}
