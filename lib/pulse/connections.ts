// Who follows a person, and who they follow, as people the viewer can act on (follow, open). Blocked people in either direction never appear.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith, followingIds } from "./graph";
import { loadPeople, type PersonSummary } from "./people";

type Service = SupabaseClient<Database>;
export type ConnectionType = "followers" | "following";
export const CONNECTIONS_LIMIT = 200;

/** A college page the person follows. Only ever listed on your own Following list. */
export interface FollowedCollege { id: string; name: string; slug: string }

export interface Connection extends PersonSummary {
  /** the viewer already follows them */
  following: boolean;
  isMe: boolean;
}

export async function listConnections(service: Service, viewerId: string, userId: string, type: ConnectionType): Promise<{ people: Connection[]; colleges: FollowedCollege[]; total: number }> {
  const db = untyped(service);
  const colleges = type === "following" && viewerId === userId ? await followedColleges(service, userId) : [];
  const [rows, blocked, mine] = await Promise.all([
    type === "followers"
      ? db.from("follows").select("follower_id, created_at", { count: "exact" }).eq("followee_id", userId).order("created_at", { ascending: false }).limit(CONNECTIONS_LIMIT)
      : db.from("follows").select("followee_id, created_at", { count: "exact" }).eq("follower_id", userId).order("created_at", { ascending: false }).limit(CONNECTIONS_LIMIT),
    blockedWith(service, viewerId),
    followingIds(service, viewerId),
  ]);
  const ids = ((rows.data ?? []) as Record<string, string>[]).map((r) => (type === "followers" ? r.follower_id : r.followee_id)).filter((id) => !blocked.has(id));
  if (ids.length === 0) return { people: [], colleges, total: (rows.count ?? 0) + colleges.length };
  const people = await loadPeople(service, ids);
  const followed = new Set(mine);
  return {
    people: ids.flatMap((id) => { const p = people.get(id); return p ? [{ ...p, following: followed.has(id), isMe: id === viewerId }] : []; }),
    colleges,
    total: (rows.count ?? ids.length) + colleges.length,
  };
}

export async function followedColleges(service: Service, userId: string): Promise<FollowedCollege[]> {
  const { data } = await untyped(service).from("org_follows").select("institution_id").eq("user_id", userId).limit(CONNECTIONS_LIMIT);
  const ids = ((data ?? []) as { institution_id: string }[]).map((r) => r.institution_id);
  if (ids.length === 0) return [];
  const { data: insts } = await service.from("institutions").select("id, name, slug").in("id", ids).order("name");
  return (insts ?? []).flatMap((i) => (i.slug ? [{ id: i.id, name: i.name, slug: i.slug }] : []));
}
