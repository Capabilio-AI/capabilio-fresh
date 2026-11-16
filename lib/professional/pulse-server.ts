import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import type { PostKind, PostValue, ReportReason } from "./pulse";
import { NOTE_HOURS, trendingTags } from "./pulse";
import { professionalNews, type NewsItem } from "./news";

const db = () => untyped(createServiceClient());

export const PAGE_SIZE = 30;
export type FeedView = "everyone" | "following" | "trending" | "mine";

export interface Person { id: string; name: string; avatarUrl: string | null; line: string; verified: boolean }
export interface Comment { id: string; author: Person; body: string; createdAt: string; mine: boolean }
export interface Post {
  id: string;
  kind: PostKind;
  title: string | null;
  body: string;
  link: string | null;
  tags: string[];
  createdAt: string;
  author: Person;
  mine: boolean;
  likes: number;
  liked: boolean;
  comments: Comment[];
}
export interface Note { id: string; author: Person; body: string; createdAt: string; mine: boolean }
export interface PulseData {
  notes: Note[];
  news: NewsItem[];
  posts: Post[];
  people: Person[];
  trending: { tag: string; count: number }[];
  counts: { posts: number; following: number; followers: number };
  following: string[];
}

interface PostRow { id: string; author_id: string; kind: PostKind; title: string | null; body: string; link: string | null; tags: string[]; created_at: string }

/** Names, avatars, jobs and verification for a set of professionals, in four queries. Never an email. */
export async function loadPros(ids: readonly string[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const [names, jobs, verification] = await Promise.all([
    db().from("profiles").select("id, full_name, avatar_url").in("id", unique),
    db().from("pro_profiles").select("user_id, headline, employer_name, job_title").in("user_id", unique),
    db().from("pro_verification").select("user_id, status").in("user_id", unique),
  ]);
  const job = new Map(((jobs.data ?? []) as { user_id: string; headline: string | null; employer_name: string | null; job_title: string | null }[]).map((j) => [j.user_id, j]));
  const verified = new Set(((verification.data ?? []) as { user_id: string; status: string }[]).filter((v) => v.status === "verified").map((v) => v.user_id));
  return new Map(
    ((names.data ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[]).map((n) => {
      const j = job.get(n.id);
      const line = [j?.job_title, j?.employer_name].filter(Boolean).join(" at ") || j?.headline || "Working professional";
      return [n.id, { id: n.id, name: n.full_name?.trim() || "Professional", avatarUrl: n.avatar_url, line, verified: verified.has(n.id) } satisfies Person];
    })
  );
}

const placeholder = (id: string): Person => ({ id, name: "Professional", avatarUrl: null, line: "Working professional", verified: false });

export async function loadPulse(viewerId: string, view: FeedView, tag: string | null): Promise<PulseData> {
  const follows = await db().from("pro_follows").select("followee_id").eq("follower_id", viewerId);
  if (follows.error) throw follows.error;
  const following = ((follows.data ?? []) as { followee_id: string }[]).map((f) => f.followee_id);

  let q = db().from("pro_posts").select("id, author_id, kind, title, body, link, tags, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(PAGE_SIZE);
  if (view === "mine") q = q.eq("author_id", viewerId);
  else if (view === "following" && following.length) q = q.in("author_id", following);
  else if (view === "trending") q = q.gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()).limit(120);
  if (tag) q = q.contains("tags", [tag]);
  const nothingToShow = view === "following" && following.length === 0;
  const [postsRes, recentRes, followerCount, postCount] = await Promise.all([
    nothingToShow ? Promise.resolve({ data: [], error: null }) : q,
    db().from("pro_posts").select("tags, created_at").is("deleted_at", null).gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()).limit(500),
    db().from("pro_follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", viewerId),
    db().from("pro_posts").select("id", { count: "exact", head: true }).eq("author_id", viewerId).is("deleted_at", null),
  ]);
  if (postsRes.error) throw postsRes.error;
  let rows = (postsRes.data ?? []) as PostRow[];
  const ids = rows.map((r) => r.id);

  const [likes, comments] = ids.length
    ? await Promise.all([
        db().from("pro_post_likes").select("post_id, user_id").in("post_id", ids),
        db().from("pro_post_comments").select("id, post_id, author_id, body, created_at").in("post_id", ids).is("deleted_at", null).order("created_at", { ascending: true }).limit(400),
      ])
    : [{ data: [] }, { data: [] }];
  const likeRows = (likes.data ?? []) as { post_id: string; user_id: string }[];
  const commentRows = (comments.data ?? []) as { id: string; post_id: string; author_id: string; body: string; created_at: string }[];

  if (view === "trending") {
    // the week's most talked-about posts: a comment counts for more than a like
    const score = (id: string) => likeRows.filter((l) => l.post_id === id).length + 3 * commentRows.filter((c) => c.post_id === id).length;
    rows = [...rows].sort((a, b) => score(b.id) - score(a.id) || b.created_at.localeCompare(a.created_at)).slice(0, PAGE_SIZE);
  }

  const suggestions = await db().from("pro_profiles").select("user_id").order("created_at", { ascending: false }).limit(40);
  const suggestedIds = ((suggestions.data ?? []) as { user_id: string }[]).map((s) => s.user_id).filter((id) => id !== viewerId && !following.includes(id)).slice(0, 6);
  const noteRes = await db().from("pro_notes").select("id, author_id, body, created_at").gte("created_at", new Date(Date.now() - NOTE_HOURS * 3_600_000).toISOString()).in("author_id", [viewerId, ...following]).order("created_at", { ascending: false }).limit(60);
  const noteRows = (noteRes.data ?? []) as { id: string; author_id: string; body: string; created_at: string }[];
  const latestNote = new Map<string, (typeof noteRows)[number]>();
  for (const n of noteRows) if (!latestNote.has(n.author_id)) latestNote.set(n.author_id, n);
  const people = await loadPros([...rows.map((r) => r.author_id), ...commentRows.map((c) => c.author_id), ...suggestedIds, ...latestNote.keys()]);
  const skillRes = await db().from("pro_skills").select("name").eq("user_id", viewerId).order("created_at").limit(6);
  const news = await professionalNews(((skillRes.data ?? []) as { name: string }[]).map((s) => s.name));
  const who = (id: string) => people.get(id) ?? placeholder(id);

  const notes: Note[] = [...latestNote.values()].map((n) => ({ id: n.id, author: who(n.author_id), body: n.body, createdAt: n.created_at, mine: n.author_id === viewerId })).sort((a, b) => Number(b.mine) - Number(a.mine));
  return {
    notes,
    news,
    posts: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      link: r.link,
      tags: r.tags,
      createdAt: r.created_at,
      author: who(r.author_id),
      mine: r.author_id === viewerId,
      likes: likeRows.filter((l) => l.post_id === r.id).length,
      liked: likeRows.some((l) => l.post_id === r.id && l.user_id === viewerId),
      comments: commentRows.filter((c) => c.post_id === r.id).map((c) => ({ id: c.id, author: who(c.author_id), body: c.body, createdAt: c.created_at, mine: c.author_id === viewerId })),
    })),
    people: suggestedIds.map(who),
    trending: trendingTags(((recentRes.data ?? []) as { tags: string[]; created_at: string }[])),
    counts: { posts: postCount.count ?? 0, following: following.length, followers: followerCount.count ?? 0 },
    following,
  };
}

export async function createPost(authorId: string, v: PostValue): Promise<string> {
  const { data, error } = await db().from("pro_posts").insert({ author_id: authorId, kind: v.kind, title: v.title, body: v.body, link: v.link, tags: v.tags }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Soft-deletes the author's own post. False when it is not theirs or is already gone. */
export async function deletePost(authorId: string, postId: string): Promise<boolean> {
  const { data, error } = await db().from("pro_posts").update({ deleted_at: new Date().toISOString() }).eq("id", postId).eq("author_id", authorId).is("deleted_at", null).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

const exists = async (postId: string): Promise<boolean> => {
  const { data } = await db().from("pro_posts").select("id").eq("id", postId).is("deleted_at", null).maybeSingle();
  return !!data;
};

/** Likes the post, or takes the like back. Null when the post does not exist. */
export async function toggleLike(userId: string, postId: string): Promise<boolean | null> {
  if (!(await exists(postId))) return null;
  const { data: had } = await db().from("pro_post_likes").select("post_id").eq("post_id", postId).eq("user_id", userId).maybeSingle();
  if (had) {
    await db().from("pro_post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    return false;
  }
  await db().from("pro_post_likes").upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
  return true;
}

export async function addComment(authorId: string, postId: string, body: string): Promise<string | null> {
  if (!(await exists(postId))) return null;
  const { data, error } = await db().from("pro_post_comments").insert({ post_id: postId, author_id: authorId, body }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Follows, or unfollows. Null when the other account is not a professional (or is the caller). */
export async function toggleFollow(userId: string, otherId: string): Promise<boolean | null> {
  if (userId === otherId) return null;
  const { data: pro } = await db().from("pro_profiles").select("user_id").eq("user_id", otherId).maybeSingle();
  if (!pro) return null;
  const { data: had } = await db().from("pro_follows").select("followee_id").eq("follower_id", userId).eq("followee_id", otherId).maybeSingle();
  if (had) {
    await db().from("pro_follows").delete().eq("follower_id", userId).eq("followee_id", otherId);
    return false;
  }
  await db().from("pro_follows").upsert({ follower_id: userId, followee_id: otherId }, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
  return true;
}

export async function reportPost(reporterId: string, postId: string, reason: ReportReason): Promise<boolean> {
  if (!(await exists(postId))) return false;
  await db().from("pro_reports").upsert({ post_id: postId, reporter_id: reporterId, reason }, { onConflict: "post_id,reporter_id", ignoreDuplicates: true });
  return true;
}

/** Puts up a note for 24 hours. A new note replaces the one before it. */
export async function createNote(authorId: string, body: string): Promise<void> {
  await db().from("pro_notes").delete().eq("author_id", authorId);
  const { error } = await db().from("pro_notes").insert({ author_id: authorId, body });
  if (error) throw error;
}

export async function deleteNote(authorId: string, noteId: string): Promise<boolean> {
  const { data, error } = await db().from("pro_notes").delete().eq("id", noteId).eq("author_id", authorId).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}
