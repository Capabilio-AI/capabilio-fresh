import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith } from "./graph";
import { legacyKind, type PostKind } from "./format";
import { signPaths } from "./media";
import { loadPeople } from "./people";
import { readMeta, type PostMeta } from "./post-schema";

export interface PulseAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
  tagline?: string | null;
  isMentor?: boolean;
}
export interface PulseComment {
  id: string;
  content: string;
  createdAt: string;
  author: PulseAuthor;
}
export interface PulseAttachment {
  url: string;
  name: string;
  size: number;
}
export interface PulsePost {
  id: string;
  content: string;
  kind: PostKind;
  /** the type-specific fields: a project's stack and links, a question's title and tags, an achievement's issuer and proof */
  meta: PostMeta | null;
  imageUrl: string | null;
  attachment: PulseAttachment | null;
  createdAt: string;
  author: PulseAuthor;
  likeCount: number;
  likedByMe: boolean;
  comments: PulseComment[];
  /** why this post is in the feed ("Trending for AI/ML Engineer") */
  reason?: string | null;
}

/** A post from a college or organisation page (an announcement or an event). */
export interface PagePost {
  id: string;
  institutionId: string;
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  type: "event" | "announcement";
  title: string;
  body: string;
  coverImageUrl: string | null;
  eventStartsAt: string | null;
  eventLocation: string | null;
  eventLink: string | null;
  publishedAt: string;
  likeCount: number;
  likedByMe: boolean;
}

export type FeedItem = { type: "post"; post: PulsePost } | { type: "page"; page: PagePost; reason: string | null };
export interface FeedPage {
  items: FeedItem[];
  /** pass back as `before` (chronological views) or `cursor` (ranked views) for the next page; null when there is no more */
  nextCursor: string | null;
}
export const FEED_PAGE = 20;
export const asPostItems = (posts: PulsePost[]): FeedItem[] => posts.map((post) => ({ type: "post", post }));

export type FeedMode = { mode: "user"; userId: string; kind?: PostKind } | { mode: "tag"; tag: string } | { mode: "mentors" };

export interface PostRow {
  id: string;
  content: string;
  kind: PostKind;
  meta: unknown;
  image_path: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  created_at: string;
  user_id: string;
}
export const POST_COLUMNS = "id, content, kind, meta, image_path, attachment_path, attachment_name, attachment_size, created_at, user_id";

/** Everyone Capabilio has approved as a mentor. */
export async function approvedMentorIds(service: SupabaseClient<Database>): Promise<string[]> {
  const { data } = await untyped(service).from("mentor_profiles").select("user_id").eq("status", "approved").limit(1000);
  const ids = ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
  return ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
}

/** Rows -> posts with authors, likes, comments, image and attachment URLs. Reads go through the signed-in user's client. */
export async function hydratePosts(supabase: SupabaseClient<Database>, service: SupabaseClient<Database>, viewerId: string, rows: PostRow[], blocked: Set<string>): Promise<PulsePost[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((p) => p.id);
  const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
    supabase.from("post_likes").select("post_id, user_id").in("post_id", ids),
    supabase.from("post_comments").select("id, post_id, content, created_at, user_id").in("post_id", ids).order("created_at", { ascending: true }),
  ]);
  if (likesError) throw likesError;
  if (commentsError) throw commentsError;

  const [people, urls] = await Promise.all([
    loadPeople(service, [...rows.map((p) => p.user_id), ...(comments ?? []).map((c) => c.user_id)]),
    signPaths(service, rows.flatMap((p) => [p.image_path, p.attachment_path])),
  ]);
  const authorOf = (userId: string): PulseAuthor => {
    const a = people.get(userId);
    return { id: userId, name: a?.name ?? null, avatarUrl: a?.avatarUrl ?? null, headline: a?.headline ?? null, tagline: a?.tagline ?? null, isMentor: a?.isMentor };
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

  return rows.map((p) => {
    const legacy = p.kind === "post" ? legacyKind(p.content) : { kind: p.kind, content: p.content };
    return {
      id: p.id,
      content: legacy.content,
      kind: legacy.kind,
      meta: readMeta(legacy.kind, p.meta),
      imageUrl: p.image_path ? (urls.get(p.image_path) ?? null) : null,
      attachment: p.attachment_path && urls.get(p.attachment_path) ? { url: urls.get(p.attachment_path) as string, name: p.attachment_name ?? "Document.pdf", size: p.attachment_size ?? 0 } : null,
      createdAt: p.created_at,
      author: authorOf(p.user_id),
      likeCount: likeCount.get(p.id) ?? 0,
      likedByMe: likedByMe.has(p.id),
      comments: byPost.get(p.id) ?? [],
    };
  });
}

/**
 * One page of a chronological view (one person, a #tag, mentors), newest first. Content from someone blocked in either direction is
 * left out. The ranked views (For You, Following, Trending) are built in ranked-feed.ts.
 */
export async function getFeed(supabase: SupabaseClient<Database>, service: SupabaseClient<Database>, viewerId: string, feed: FeedMode, before: string | null = null): Promise<FeedPage> {
  const blocked = await blockedWith(service, viewerId);
  let query = untyped(supabase).from("posts").select(POST_COLUMNS).order("created_at", { ascending: false }).limit(FEED_PAGE + 1);
  if (before) query = query.lt("created_at", before);
  if (blocked.size > 0) query = query.not("user_id", "in", `(${[...blocked].join(",")})`);
  if (feed.mode === "mentors") query = query.in("user_id", await approvedMentorIds(service));
  if (feed.mode === "user") {
    query = query.eq("user_id", feed.userId);
    if (feed.kind) query = query.eq("kind", feed.kind);
  }
  if (feed.mode === "tag") query = query.contains("tags", [feed.tag]);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as PostRow[];
  const page = rows.slice(0, FEED_PAGE);
  return { items: asPostItems(await hydratePosts(supabase, service, viewerId, page, blocked)), nextCursor: rows.length > FEED_PAGE ? page[page.length - 1].created_at : null };
}
