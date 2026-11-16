import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";

const db = () => untyped(createServiceClient());

export interface Alert { id: string; kind: "mentor_request" | "mentor_cancelled" | "system"; title: string; body: string | null; link: string | null; read: boolean; createdAt: string }

export async function listAlerts(userId: string): Promise<Alert[]> {
  const { data, error } = await db().from("pro_notifications").select("id, kind, title, body, link, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return ((data ?? []) as { id: string; kind: Alert["kind"]; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }[]).map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, link: r.link, read: r.read_at !== null, createdAt: r.created_at }));
}

/** How many alerts are unread. Zero when they cannot be counted, so a problem here never breaks a page. */
export async function unreadAlerts(userId: string): Promise<number> {
  try {
    const { count } = await db().from("pro_notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function markAllRead(userId: string): Promise<boolean> {
  const { error } = await db().from("pro_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  return !error;
}
