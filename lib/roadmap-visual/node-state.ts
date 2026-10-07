import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";

type Service = SupabaseClient<Database>;

export const NodeStateBody = z
  .object({
    nodeKey: z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/),
    careerId: z.string().uuid(),
    /** null clears the student's mark */
    status: z.enum(["LEARNING", "DONE", "SKIPPED"]).nullable(),
    reason: z.string().trim().min(3).max(300).optional(),
  })
  .strict()
  .refine((b) => b.status !== "SKIPPED" || Boolean(b.reason), { message: "Say why you are skipping this topic.", path: ["reason"] });

export class NodeStateError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Saves what the student says about a node of a PUBLISHED tree for their chosen career. Only their own state, only a real node. */
export async function setNodeState(service: Service, userId: string, body: z.infer<typeof NodeStateBody>): Promise<void> {
  const db = untyped(service);
  const { data: template } = await db.from("roadmap_templates").select("id").eq("career_id", body.careerId).eq("status", "PUBLISHED").maybeSingle();
  if (!template) throw new NodeStateError("That roadmap isn't available.", 404);
  const { data: node } = await db.from("roadmap_nodes").select("id, type").eq("template_id", template.id).eq("node_key", body.nodeKey).maybeSingle();
  if (!node) throw new NodeStateError("That topic doesn't exist.", 404);
  if (node.type !== "TOPIC") throw new NodeStateError("Only topics can be marked.", 400);
  if (body.status === null) {
    const { error } = await db.from("roadmap_node_state").delete().eq("student_id", userId).eq("node_id", node.id);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("roadmap_node_state").upsert({ student_id: userId, node_id: node.id, status: body.status, skip_reason: body.status === "SKIPPED" ? body.reason : null, updated_at: new Date().toISOString() }, { onConflict: "student_id,node_id" });
  if (error) throw error;
}

export const SemesterBody = z.object({ semester: z.union([z.literal(1), z.literal(2)]) }).strict();

/** The student confirms their current semester (1 or 2 of their year). Their own active student membership only. */
export async function confirmSemester(service: Service, userId: string, semester: 1 | 2): Promise<void> {
  const db = untyped(service);
  const { data: rows } = await db.from("institution_memberships").select("id, branch, status").eq("user_id", userId).eq("role", "student").eq("status", "active").order("created_at", { ascending: false });
  const membership = ((rows ?? []) as { id: string; branch: string | null }[]).find((m) => m.branch);
  if (!membership) throw new NodeStateError("Add your college and branch first.", 409);
  const { error } = await db.from("institution_memberships").update({ current_semester: semester, semester_confirmed_at: new Date().toISOString() }).eq("id", membership.id);
  if (error) throw error;
}
