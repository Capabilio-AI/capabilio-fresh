import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface PulseComment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; avatarUrl: string | null };
}

export interface PulsePost {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; avatarUrl: string | null };
  likeCount: number;
  likedByMe: boolean;
  comments: PulseComment[];
}

const FEED_LIMIT = 50;

/**
 * A global feed (no follow/connection graph exists yet) — every post,
 * newest first, with aggregated likes and full comment threads. Fetched
 * as four flat queries instead of N+1 per-post lookups.
 *
 * Author names are resolved via the get_public_profiles RPC, not a
 * PostgREST embed — profiles' own RLS is select-own-only (it carries
 * email), so an embed silently returns null for every author who isn't
 * the viewer. The RPC is a narrow, audited SECURITY DEFINER function
 * that only ever returns id/full_name/avatar_url.
 */
export async function getFeed(supabase: SupabaseClient<Database>, viewerId: string): Promise<PulsePost[]> {
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("id, content, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (postsError) throw postsError;
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);
  const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
    supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
    supabase
      .from("post_comments")
      .select("id, post_id, content, created_at, user_id")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
  ]);
  if (likesError) throw likesError;
  if (commentsError) throw commentsError;

  const authorIds = new Set<string>();
  for (const p of posts) authorIds.add(p.user_id);
  for (const c of comments ?? []) authorIds.add(c.user_id);
  const { data: authors, error: authorsError } = await supabase.rpc("get_public_profiles", {
    p_ids: [...authorIds],
  });
  if (authorsError) throw authorsError;
  const authorById = new Map((authors ?? []).map((a) => [a.id, a]));
  function authorOf(userId: string) {
    const a = authorById.get(userId);
    return { id: userId, name: a?.full_name ?? null, avatarUrl: a?.avatar_url ?? null };
  }

  const likeCountByPost = new Map<string, number>();
  const likedByMeSet = new Set<string>();
  for (const like of likes ?? []) {
    likeCountByPost.set(like.post_id, (likeCountByPost.get(like.post_id) ?? 0) + 1);
    if (like.user_id === viewerId) likedByMeSet.add(like.post_id);
  }

  const commentsByPost = new Map<string, PulseComment[]>();
  for (const c of comments ?? []) {
    const bucket = commentsByPost.get(c.post_id) ?? [];
    bucket.push({ id: c.id, content: c.content, createdAt: c.created_at, author: authorOf(c.user_id) });
    commentsByPost.set(c.post_id, bucket);
  }

  return posts.map((p) => ({
    id: p.id,
    content: p.content,
    createdAt: p.created_at,
    author: authorOf(p.user_id),
    likeCount: likeCountByPost.get(p.id) ?? 0,
    likedByMe: likedByMeSet.has(p.id),
    comments: commentsByPost.get(p.id) ?? [],
  }));
}
