import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith } from "./graph";
import type { FeedPage, PulseAuthor, PulseComment, PulsePost } from "./data";
import { FEED_PAGE } from "./data";
import { ownsMedia, signPaths } from "./media";
import { loadPeople } from "./people";
import type { Access, CommunityRow } from "./communities";
import { canModerate } from "./community-rules";
import type { PostKind } from "./format";

type Service = SupabaseClient<Database>;
interface Row { id: string; content: string; kind: PostKind; image_path: string | null; created_at: string; user_id: string }

/** One page of a community's posts. The caller has already checked the viewer may read this community. */
export async function getCommunityFeed(service: Service, viewerId: string, community: CommunityRow, before: string | null): Promise<FeedPage> {
  const db = untyped(service);
  const blocked = await blockedWith(service, viewerId);
  let q = db.from("community_posts").select("id, content, kind, image_path, created_at, user_id").eq("community_id", community.id).order("created_at", { ascending: false }).limit(FEED_PAGE + 1);
  if (before) q = q.lt("created_at", before);
  if (blocked.size > 0) q = q.not("user_id", "in", `(${[...blocked].join(",")})`);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const page = rows.slice(0, FEED_PAGE);
  if (page.length === 0) return { posts: [], nextCursor: null };
  const ids = page.map((p) => p.id);
  const [{ data: likes }, { data: comments }] = await Promise.all([
    db.from("community_post_likes").select("post_id, user_id").in("post_id", ids),
    db.from("community_post_comments").select("id, post_id, content, created_at, user_id").in("post_id", ids).order("created_at", { ascending: true }),
  ]);
  const cs = (comments ?? []) as { id: string; post_id: string; content: string; created_at: string; user_id: string }[];
  const [people, urls] = await Promise.all([loadPeople(service, [...page.map((p) => p.user_id), ...cs.map((c) => c.user_id)]), signPaths(service, page.map((p) => p.image_path))]);
  const authorOf = (id: string): PulseAuthor => ({ id, name: people.get(id)?.name ?? null, avatarUrl: people.get(id)?.avatarUrl ?? null, headline: people.get(id)?.headline ?? null, isMentor: people.get(id)?.isMentor });
  const likeList = (likes ?? []) as { post_id: string; user_id: string }[];
  const byPost = new Map<string, PulseComment[]>();
  for (const c of cs) if (!blocked.has(c.user_id)) byPost.set(c.post_id, [...(byPost.get(c.post_id) ?? []), { id: c.id, content: c.content, createdAt: c.created_at, author: authorOf(c.user_id) }]);
  const posts: PulsePost[] = page.map((p) => ({
    id: p.id, content: p.content, kind: p.kind, imageUrl: p.image_path ? (urls.get(p.image_path) ?? null) : null, createdAt: p.created_at, author: authorOf(p.user_id),
    likeCount: likeList.filter((l) => l.post_id === p.id).length, likedByMe: likeList.some((l) => l.post_id === p.id && l.user_id === viewerId), comments: byPost.get(p.id) ?? [],
  }));
  return { posts, nextCursor: rows.length > FEED_PAGE ? page[page.length - 1].created_at : null };
}

export type Outcome = { ok: true } | { ok: false; status: number; message: string };
const fail = (status: number, message: string): Outcome => ({ ok: false, status, message });

export async function createCommunityPost(service: Service, userId: string, access: Access, community: CommunityRow, input: { content: string; kind: PostKind; imagePath?: string }): Promise<Outcome> {
  if (!access.member) return fail(403, "Join this community to post in it.");
  if (input.imagePath && !ownsMedia(userId, "post", input.imagePath)) return fail(400, "That image wasn't uploaded by you.");
  const { error } = await untyped(service).from("community_posts").insert({ community_id: community.id, user_id: userId, content: input.content, kind: input.kind, image_path: input.imagePath ?? null });
  return error ? fail(500, "Couldn't post. Please try again.") : { ok: true };
}

async function postIn(service: Service, community: CommunityRow, postId: string): Promise<{ id: string; user_id: string; image_path: string | null } | null> {
  const { data } = await untyped(service).from("community_posts").select("id, user_id, image_path").eq("id", postId).eq("community_id", community.id).maybeSingle();
  return (data as { id: string; user_id: string; image_path: string | null } | null) ?? null;
}

export async function toggleCommunityLike(service: Service, userId: string, access: Access, community: CommunityRow, postId: string): Promise<Outcome> {
  if (!access.member || !(await postIn(service, community, postId))) return fail(404, "Post not found.");
  const db = untyped(service);
  const { data: existing } = await db.from("community_post_likes").select("post_id").eq("post_id", postId).eq("user_id", userId).maybeSingle();
  const { error } = existing ? await db.from("community_post_likes").delete().eq("post_id", postId).eq("user_id", userId) : await db.from("community_post_likes").insert({ post_id: postId, user_id: userId });
  return error ? fail(500, "Couldn't update. Please try again.") : { ok: true };
}

export async function addCommunityComment(service: Service, userId: string, access: Access, community: CommunityRow, postId: string, content: string): Promise<{ ok: true; comment: PulseComment } | { ok: false; status: number; message: string }> {
  if (!access.member || !(await postIn(service, community, postId))) return fail(404, "Post not found.") as { ok: false; status: number; message: string };
  const { data, error } = await untyped(service).from("community_post_comments").insert({ post_id: postId, user_id: userId, content }).select("id, content, created_at").single();
  if (error || !data) return { ok: false, status: 500, message: "Couldn't comment. Please try again." };
  const me = (await loadPeople(service, [userId])).get(userId);
  const row = data as { id: string; content: string; created_at: string };
  return { ok: true, comment: { id: row.id, content: row.content, createdAt: row.created_at, author: { id: userId, name: me?.name ?? null, avatarUrl: me?.avatarUrl ?? null, headline: me?.headline ?? null, isMentor: me?.isMentor } } };
}

/** The author, or someone who moderates the community, may delete a post. */
export async function deleteCommunityPost(service: Service, userId: string, access: Access, community: CommunityRow, postId: string): Promise<Outcome> {
  const post = await postIn(service, community, postId);
  if (!post) return fail(404, "Post not found.");
  if (post.user_id !== userId && !canModerate(access.role)) return fail(403, "You can't delete this post.");
  const { error } = await untyped(service).from("community_posts").delete().eq("id", postId);
  return error ? fail(500, "Couldn't delete. Please try again.") : { ok: true };
}
