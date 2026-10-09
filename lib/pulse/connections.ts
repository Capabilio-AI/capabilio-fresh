// Who follows a person, and who they follow, as people the viewer can act on (follow, open). Blocked people in either direction never appear.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith, followingIds } from "./graph";
import { loadPeople, type PersonSummary } from "./people";

type Service = SupabaseClient<Database>;
export type ConnectionType = "followers" | "following";
export const CONNECTIONS_LIMIT = 200;

export interface Connection extends PersonSummary {
  /** the viewer already follows them */
  following: boolean;
  isMe: boolean;
}

export async function listConnections(service: Service, viewerId: string, userId: string, type: ConnectionType): Promise<{ people: Connection[]; total: number }> {
  const db = untyped(service);
  const [rows, blocked, mine] = await Promise.all([
    type === "followers"
      ? db.from("follows").select("follower_id, created_at", { count: "exact" }).eq("followee_id", userId).order("created_at", { ascending: false }).limit(CONNECTIONS_LIMIT)
      : db.from("follows").select("followee_id, created_at", { count: "exact" }).eq("follower_id", userId).order("created_at", { ascending: false }).limit(CONNECTIONS_LIMIT),
    blockedWith(service, viewerId),
    followingIds(service, viewerId),
  ]);
  const ids = ((rows.data ?? []) as Record<string, string>[]).map((r) => (type === "followers" ? r.follower_id : r.followee_id)).filter((id) => !blocked.has(id));
  if (ids.length === 0) return { people: [], total: rows.count ?? 0 };
  const people = await loadPeople(service, ids);
  const followed = new Set(mine);
  return {
    people: ids.flatMap((id) => { const p = people.get(id); return p ? [{ ...p, following: followed.has(id), isMe: id === viewerId }] : []; }),
    total: rows.count ?? ids.length,
  };
}
