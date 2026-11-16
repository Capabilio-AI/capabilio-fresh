import { adminDb, rowsOf } from "./db";

export interface AuditRow { id: string; actorId: string | null; action: string; target: string | null; detail: string | null; at: string }

/** Records what an admin did (team changes, exports, password changes). A missing table never blocks the action itself. */
export async function audit(actorId: string, action: string, target?: string | null, detail?: string | null): Promise<void> {
  const { error } = await adminDb().from("admin_audit").insert({ actor_id: actorId, action: action.slice(0, 60), target: target?.slice(0, 200) ?? null, detail: detail?.slice(0, 300) ?? null });
  if (error && error.code !== "42P01" && error.code !== "PGRST205") console.error("[admin] audit failed:", error.message);
}

export async function listAudit(limit = 100): Promise<{ available: boolean; rows: AuditRow[] }> {
  const res = await adminDb().from("admin_audit").select("id, actor_id, action, target, detail, created_at").order("created_at", { ascending: false }).limit(limit);
  if (res.error) return { available: false, rows: [] };
  return { available: true, rows: rowsOf<{ id: string; actor_id: string | null; action: string; target: string | null; detail: string | null; created_at: string }>(res).map((r) => ({ id: r.id, actorId: r.actor_id, action: r.action, target: r.target, detail: r.detail, at: r.created_at })) };
}
