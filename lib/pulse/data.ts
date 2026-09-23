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
 * as three flat queries instead of N+1 per-post lookups.
 */
export async function getFeed(supabase: SupabaseClient<Database>, viewerId: string): Promise<PulsePost[]> {
  // post_likes has its own FKs to both posts and profiles, which makes
  // PostgREST see a second (many-to-many, via post_likes) path from posts
  // to profiles — the embed must name the direct FK explicitly or it's
  // ambiguous.
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("id, content, created_at, user_id, profiles!posts_user_id_fkey ( full_name, avatar_url )")
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (postsError) throw postsError;
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);
  const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
    supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
    supabase
      .from("post_comments")
      .select("id, post_id, content, created_at, user_id, profiles ( full_name, avatar_url )")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
  ]);
  if (likesError) throw likesError;
  if (commentsError) throw commentsError;

  const likeCountByPost = new Map<string, number>();
  const likedByMeSet = new Set<string>();
  for (const like of likes ?? []) {
    likeCountByPost.set(like.post_id, (likeCountByPost.get(like.post_id) ?? 0) + 1);
    if (like.user_id === viewerId) likedByMeSet.add(like.post_id);
  }

  const commentsByPost = new Map<string, PulseComment[]>();
  for (const c of comments ?? []) {
    const author = c.profiles as { full_name: string | null; avatar_url: string | null } | null;
    const bucket = commentsByPost.get(c.post_id) ?? [];
    bucket.push({
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      author: { id: c.user_id, name: author?.full_name ?? null, avatarUrl: author?.avatar_url ?? null },
    });
    commentsByPost.set(c.post_id, bucket);
  }

  return posts.map((p) => {
    const author = p.profiles as { full_name: string | null; avatar_url: string | null } | null;
    return {
      id: p.id,
      content: p.content,
      createdAt: p.created_at,
      author: { id: p.user_id, name: author?.full_name ?? null, avatarUrl: author?.avatar_url ?? null },
      likeCount: likeCountByPost.get(p.id) ?? 0,
      likedByMe: likedByMeSet.has(p.id),
      comments: commentsByPost.get(p.id) ?? [],
    };
  });
}
