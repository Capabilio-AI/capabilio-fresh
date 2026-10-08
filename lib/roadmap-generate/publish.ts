import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { PROVENANCE_METHOD } from "./normalize";

type Service = SupabaseClient<Database>;

/**
 * Publishes a machine-validated draft: the career's current published version is retired, the draft is published as AI_GENERATED (no reviewer is
 * claimed), and the students' Learning/Skipped marks follow their topics to the new version (matched by node key, which is derived from the skill).
 */
export async function publishGenerated(service: Service, templateId: string, careerId: string, model: string): Promise<{ marksCarried: number }> {
  const db = untyped(service);
  const { data: old } = await db.from("roadmap_templates").select("id").eq("career_id", careerId).eq("status", "PUBLISHED").neq("id", templateId);
  const oldIds = ((old ?? []) as { id: string }[]).map((t) => t.id);

  const { error: retireError } = oldIds.length ? await db.from("roadmap_templates").update({ status: "RETIRED" }).in("id", oldIds) : { error: null };
  if (retireError) throw retireError;
  const { error } = await db.from("roadmap_templates").update({
    status: "PUBLISHED", source: "AI_GENERATED", reviewed_by: null, reviewed_at: null, published_at: new Date().toISOString(),
    provenance: { designedBy: `AI (${model})`, method: PROVENANCE_METHOD },
  }).eq("id", templateId);
  if (error) throw error;

  return { marksCarried: oldIds.length ? await carryMarks(service, oldIds, templateId) : 0 };
}

async function carryMarks(service: Service, fromTemplateIds: string[], toTemplateId: string): Promise<number> {
  const db = untyped(service);
  const [{ data: oldNodes }, { data: newNodes }] = await Promise.all([
    db.from("roadmap_nodes").select("id, node_key").in("template_id", fromTemplateIds).eq("type", "TOPIC"),
    db.from("roadmap_nodes").select("id, node_key").eq("template_id", toTemplateId).eq("type", "TOPIC"),
  ]);
  const keyOfOld = new Map(((oldNodes ?? []) as { id: string; node_key: string }[]).map((n) => [n.id, n.node_key]));
  const newByKey = new Map(((newNodes ?? []) as { id: string; node_key: string }[]).map((n) => [n.node_key, n.id]));
  if (keyOfOld.size === 0 || newByKey.size === 0) return 0;
  const { data: marks } = await db.from("roadmap_node_state").select("student_id, node_id, status, skip_reason").in("node_id", [...keyOfOld.keys()]);
  const rows = ((marks ?? []) as { student_id: string; node_id: string; status: string; skip_reason: string | null }[]).flatMap((m) => {
    const target = newByKey.get(keyOfOld.get(m.node_id) ?? "");
    return target ? [{ student_id: m.student_id, node_id: target, status: m.status, skip_reason: m.skip_reason, updated_at: new Date().toISOString() }] : [];
  });
  if (rows.length === 0) return 0;
  const { error } = await db.from("roadmap_node_state").upsert(rows, { onConflict: "student_id,node_id", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}
