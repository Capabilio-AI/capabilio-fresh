import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";

type Service = SupabaseClient<Database>;

export type GraphResult = { ok: true } | { ok: false; status: number; message: string };
const fail = (status: number, message: string): GraphResult => ({ ok: false, status, message });

/** Everyone the user has blocked or who has blocked them. Content from either direction is hidden. */
export async function blockedWith(service: Service, userId: string): Promise<Set<string>> {
  const db = untyped(service);
  const [{ data: mine }, { data: theirs }] = await Promise.all([
    db.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
    db.from("user_blocks").select("blocker_id").eq("blocked_id", userId),
  ]);
  return new Set([...((mine ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id), ...((theirs ?? []) as { blocker_id: string }[]).map((r) => r.blocker_id)]);
}

export async function followingIds(service: Service, userId: string): Promise<string[]> {
  const { data } = await untyped(service).from("follows").select("followee_id").eq("follower_id", userId).limit(5000);
  return ((data ?? []) as { followee_id: string }[]).map((r) => r.followee_id);
}

export async function follow(service: Service, followerId: string, followeeId: string): Promise<GraphResult> {
  if (followerId === followeeId) return fail(400, "You can't follow yourself.");
  const { data: target } = await service.from("profiles").select("id").eq("id", followeeId).maybeSingle();
  if (!target) return fail(404, "That profile doesn't exist.");
  if ((await blockedWith(service, followerId)).has(followeeId)) return fail(403, "You can't follow this person.");
  const { error } = await untyped(service).from("follows").upsert({ follower_id: followerId, followee_id: followeeId }, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
  return error ? fail(500, "Couldn't follow. Please try again.") : { ok: true };
}

export async function unfollow(service: Service, followerId: string, followeeId: string): Promise<GraphResult> {
  const { error } = await untyped(service).from("follows").delete().eq("follower_id", followerId).eq("followee_id", followeeId);
  return error ? fail(500, "Couldn't unfollow. Please try again.") : { ok: true };
}

/** Blocking also severs the follow graph in both directions. */
export async function block(service: Service, blockerId: string, blockedId: string): Promise<GraphResult> {
  if (blockerId === blockedId) return fail(400, "You can't block yourself.");
  const db = untyped(service);
  const { error } = await db.from("user_blocks").upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  if (error) return fail(500, "Couldn't block. Please try again.");
  await Promise.all([
    db.from("follows").delete().eq("follower_id", blockerId).eq("followee_id", blockedId),
    db.from("follows").delete().eq("follower_id", blockedId).eq("followee_id", blockerId),
  ]);
  return { ok: true };
}

export async function unblock(service: Service, blockerId: string, blockedId: string): Promise<GraphResult> {
  const { error } = await untyped(service).from("user_blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  return error ? fail(500, "Couldn't unblock. Please try again.") : { ok: true };
}

/** Stories are for followers: the owner, or someone who follows the owner and is not blocked either way. */
export async function canViewStories(service: Service, viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const [{ data: edge }, blocked] = await Promise.all([
    untyped(service).from("follows").select("follower_id").eq("follower_id", viewerId).eq("followee_id", ownerId).maybeSingle(),
    blockedWith(service, viewerId),
  ]);
  return Boolean(edge) && !blocked.has(ownerId);
}

export interface ProfileCounts {
  followers: number;
  following: number;
  posts: number;
}
export async function profileCounts(service: Service, userId: string): Promise<ProfileCounts> {
  const db = untyped(service);
  const head = { count: "exact", head: true } as const;
  const [a, b, c] = await Promise.all([
    db.from("follows").select("follower_id", head).eq("followee_id", userId),
    db.from("follows").select("followee_id", head).eq("follower_id", userId),
    db.from("posts").select("id", head).eq("user_id", userId),
  ]);
  return { followers: a.count ?? 0, following: b.count ?? 0, posts: c.count ?? 0 };
}
