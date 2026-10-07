import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith, followingIds } from "./graph";
import { escapeLike, legacyKind, type PostKind } from "./format";
import { signPaths } from "./media";
import { loadPeople } from "./people";

export interface PulseAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
  isMentor?: boolean;
}
export interface PulseComment {
  id: string;
  content: string;
  createdAt: string;
  author: PulseAuthor;
}
export interface PulsePost {
  id: string;
  content: string;
  kind: PostKind;
  imageUrl: string | null;
  createdAt: string;
  author: PulseAuthor;
  likeCount: number;
  likedByMe: boolean;
  comments: PulseComment[];
}

export type FeedMode = { mode: "for_you" } | { mode: "following" } | { mode: "user"; userId: string } | { mode: "tag"; tag: string } | { mode: "mentors" };
export interface FeedPage {
  posts: PulsePost[];
  /** created_at of the last post: pass it back as `before` for the next page; null when there is no more */
  nextCursor: string | null;
}
export const FEED_PAGE = 20;

/** Everyone Capabilio has approved as a mentor. */
export async function approvedMentorIds(service: SupabaseClient<Database>): Promise<string[]> {
  const { data } = await untyped(service).from("mentor_profiles").select("user_id").eq("status", "approved").limit(1000);
  const ids = ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
  return ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
}

interface PostRow {
  id: string;
  content: string;
  kind: PostKind;
  image_path: string | null;
  created_at: string;
  user_id: string;
}

/**
 * One page of the feed, newest first. Reads go through the signed-in user's client (the posts policies decide what they may read);
 * the follow graph, blocks, author names and image URLs come from the service client. Authors are resolved without ever touching
 * `profiles.email`. Content from someone blocked in either direction is left out.
 */
export async function getFeed(supabase: SupabaseClient<Database>, service: SupabaseClient<Database>, viewerId: string, feed: FeedMode, before: string | null = null): Promise<FeedPage> {
  const blocked = await blockedWith(service, viewerId);
  let query = untyped(supabase).from("posts").select("id, content, kind, image_path, created_at, user_id").order("created_at", { ascending: false }).limit(FEED_PAGE + 1);
  if (before) query = query.lt("created_at", before);
  if (blocked.size > 0) query = query.not("user_id", "in", `(${[...blocked].join(",")})`);
  if (feed.mode === "following") query = query.in("user_id", [viewerId, ...(await followingIds(service, viewerId))]);
  if (feed.mode === "mentors") query = query.in("user_id", await approvedMentorIds(service));
  if (feed.mode === "user") query = query.eq("user_id", feed.userId);
  if (feed.mode === "tag") query = query.ilike("content", `%#${escapeLike(feed.tag)}%`);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as PostRow[];
  const page = rows.slice(0, FEED_PAGE);
  if (page.length === 0) return { posts: [], nextCursor: null };

  const ids = page.map((p) => p.id);
  const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
    supabase.from("post_likes").select("post_id, user_id").in("post_id", ids),
    supabase.from("post_comments").select("id, post_id, content, created_at, user_id").in("post_id", ids).order("created_at", { ascending: true }),
  ]);
  if (likesError) throw likesError;
  if (commentsError) throw commentsError;

  const [people, urls] = await Promise.all([
    loadPeople(service, [...page.map((p) => p.user_id), ...(comments ?? []).map((c) => c.user_id)]),
    signPaths(service, page.map((p) => p.image_path)),
  ]);
  const authorOf = (userId: string): PulseAuthor => {
    const a = people.get(userId);
    return { id: userId, name: a?.name ?? null, avatarUrl: a?.avatarUrl ?? null, headline: a?.headline ?? null, isMentor: a?.isMentor };
  };

  const likeCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const like of likes ?? []) {
    likeCount.set(like.post_id, (likeCount.get(like.post_id) ?? 0) + 1);
    if (like.user_id === viewerId) likedByMe.add(like.post_id);
  }
  const byPost = new Map<string, PulseComment[]>();
  for (const c of comments ?? []) {
    if (blocked.has(c.user_id)) continue;
    byPost.set(c.post_id, [...(byPost.get(c.post_id) ?? []), { id: c.id, content: c.content, createdAt: c.created_at, author: authorOf(c.user_id) }]);
  }

  return {
    posts: page.map((p) => {
      const legacy = p.kind === "post" ? legacyKind(p.content) : { kind: p.kind, content: p.content };
      return {
        id: p.id, content: legacy.content, kind: legacy.kind, imageUrl: p.image_path ? (urls.get(p.image_path) ?? null) : null, createdAt: p.created_at,
        author: authorOf(p.user_id), likeCount: likeCount.get(p.id) ?? 0, likedByMe: likedByMe.has(p.id), comments: byPost.get(p.id) ?? [],
      };
    }),
    nextCursor: rows.length > FEED_PAGE ? page[page.length - 1].created_at : null,
  };
}
