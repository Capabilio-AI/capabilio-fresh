import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped, type OrgPostRow } from "@/lib/org/db";
import { postVisibleTo } from "@/lib/org/presence";
import { loadCareerContext } from "./career-context";
import { FEED_PAGE, POST_COLUMNS, hydratePosts, type FeedItem, type FeedPage, type PagePost, type PostRow } from "./data";
import { blockedWith, followingIds } from "./graph";
import { engagementOf, reasonFor, relevance, scoreItem, trendingScore, type CareerContext } from "./relevance";

type Service = SupabaseClient<Database>;
export type RankedMode = "for_you" | "following" | "trending";

const DAY_MS = 86_400_000;
const WINDOW_DAYS: Record<RankedMode, number> = { for_you: 14, following: 30, trending: 7 };
const PAGE_WINDOW_DAYS = 45;
const CANDIDATES = 400;
const PAGE_CANDIDATES = 100;
const TRENDING_MIN_RELEVANCE = 0.34;
/** the ranking is frozen at this granularity so "load more" continues the same list */
const FREEZE_MS = 5 * 60_000;

export function formatCursor(asOf: number, offset: number): string {
  return `${asOf}.${offset}`;
}
/** Pure. A cursor from an earlier request, or a fresh one. */
export function parseCursor(cursor: string | null, now = Date.now()): { asOf: number; offset: number } {
  const m = cursor ? /^(\d{10,16})\.(\d{1,5})$/.exec(cursor) : null;
  return m ? { asOf: Number(m[1]), offset: Number(m[2]) } : { asOf: Math.floor(now / FREEZE_MS) * FREEZE_MS, offset: 0 };
}

interface Candidate {
  key: string;
  at: number;
  score: number;
  item: { kind: "post"; row: PostRow; reason: string | null } | { kind: "page"; page: PagePost; reason: string | null };
}

interface OrgRow extends OrgPostRow {}

/** Posts from the college and organisation pages a person follows or belongs to. */
async function loadPagePosts(service: Service, viewerId: string, mode: RankedMode, asOf: number): Promise<{ page: PagePost; own: boolean; followed: boolean }[]> {
  if (mode === "trending") return [];
  const db = untyped(service);
  const [{ data: follows }, { data: memberships }] = await Promise.all([
    db.from("org_follows").select("institution_id").eq("user_id", viewerId),
    service.from("institution_memberships").select("institution_id").eq("user_id", viewerId).eq("status", "active"),
  ]);
  const followed = new Set(((follows ?? []) as { institution_id: string }[]).map((f) => f.institution_id));
  const member = new Set((memberships ?? []).map((m) => m.institution_id));
  const ids = [...new Set([...followed, ...member])];
  if (ids.length === 0) return [];
  const since = new Date(asOf - PAGE_WINDOW_DAYS * DAY_MS).toISOString();
  const [{ data: posts }, { data: profiles }, { data: insts }] = await Promise.all([
    db.from("org_posts").select("*").in("institution_id", ids).eq("status", "published").gte("published_at", since).lte("published_at", new Date(asOf).toISOString()).order("published_at", { ascending: false }).limit(PAGE_CANDIDATES),
    db.from("org_profiles").select("institution_id, is_public, logo_url").in("institution_id", ids),
    service.from("institutions").select("id, name, slug").in("id", ids),
  ]);
  const profile = new Map(((profiles ?? []) as { institution_id: string; is_public: boolean; logo_url: string | null }[]).map((p) => [p.institution_id, p]));
  const inst = new Map((insts ?? []).map((i) => [i.id, i]));
  const visible = ((posts ?? []) as OrgRow[]).filter((p) => postVisibleTo({ post: p, profilePublic: Boolean(profile.get(p.institution_id)?.is_public), isMember: member.has(p.institution_id) }) && inst.has(p.institution_id));
  if (visible.length === 0) return [];
  const { data: likes } = await db.from("org_post_likes").select("post_id, user_id").in("post_id", visible.map((p) => p.id));
  const likeRows = (likes ?? []) as { post_id: string; user_id: string }[];
  return visible.map((p) => {
    const i = inst.get(p.institution_id)!;
    return {
      own: member.has(p.institution_id),
      followed: followed.has(p.institution_id),
      page: {
        id: p.id, institutionId: p.institution_id, orgName: i.name, orgSlug: i.slug, logoUrl: profile.get(p.institution_id)?.logo_url ?? null, type: p.type, title: p.title, body: p.body,
        coverImageUrl: p.cover_image_url, eventStartsAt: p.event_starts_at, eventLocation: p.event_location, eventLink: p.event_link, publishedAt: p.published_at ?? p.created_at,
        likeCount: likeRows.filter((l) => l.post_id === p.id).length, likedByMe: likeRows.some((l) => l.post_id === p.id && l.user_id === viewerId),
      },
    };
  });
}

const textOf = (r: PostRow) => `${r.content} ${(r.meta as { title?: string } | null)?.title ?? ""} ${((r as { tags?: string[] }).tags ?? []).join(" ")}`;

/**
 * The personalised feeds. For You is the people you follow and you, ranked by recency, relevance to your career goal and engagement, plus
 * posts from your college and the pages you follow. Following is those people and pages, newest first. Trending is this week's most-engaged posts,
 * lifted when they fit your goal. The candidate set is scored once and frozen per `cursor`, so paging never reshuffles.
 */
export async function getRankedFeed(supabase: SupabaseClient<Database>, service: Service, viewerId: string, mode: RankedMode, cursor: string | null): Promise<FeedPage & { role: string | null }> {
  const { asOf, offset } = parseCursor(cursor);
  const [blocked, following, ctx, pages] = await Promise.all([blockedWith(service, viewerId), followingIds(service, viewerId), loadCareerContext(service, viewerId), loadPagePosts(service, viewerId, mode, asOf)]);
  const followed = new Set(following);
  const role = ctx.roles[0] ?? null;

  let query = untyped(supabase).from("posts").select(`${POST_COLUMNS}, tags`).gte("created_at", new Date(asOf - WINDOW_DAYS[mode] * DAY_MS).toISOString()).lte("created_at", new Date(asOf).toISOString()).order("created_at", { ascending: false }).limit(CANDIDATES);
  if (blocked.size > 0) query = query.not("user_id", "in", `(${[...blocked].join(",")})`);
  if (mode === "following") query = query.in("user_id", [viewerId, ...following]);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as PostRow[];

  const ids = rows.map((r) => r.id);
  const [{ data: likes }, { data: comments }] = ids.length
    ? await Promise.all([supabase.from("post_likes").select("post_id").in("post_id", ids), supabase.from("post_comments").select("post_id").in("post_id", ids)])
    : [{ data: [] }, { data: [] }];
  const count = (list: { post_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of list ?? []) m.set(r.post_id, (m.get(r.post_id) ?? 0) + 1);
    return m;
  };
  const likeCount = count(likes);
  const commentCount = count(comments);

  const scored: Candidate[] = [];
  for (const r of rows) {
    const eng = engagementOf(likeCount.get(r.id) ?? 0, commentCount.get(r.id) ?? 0);
    const rel = relevance(textOf(r), ctx.keywords);
    const isFollowed = followed.has(r.user_id) || r.user_id === viewerId;
    // Your feed is the people you follow and you. Posts from strangers appear only under Trending, never mixed in here.
    if (mode === "for_you" && !isFollowed) continue;
    const at = new Date(r.created_at).getTime();
    const input = { ageHours: (asOf - at) / 3_600_000, engagement: eng, relevance: rel, followed: isFollowed, page: false, ownCollege: false };
    if (mode === "trending" && eng < 1 && rel < TRENDING_MIN_RELEVANCE) continue;
    scored.push({
      key: `p-${r.id}`, at,
      score: mode === "following" ? at : mode === "trending" ? trendingScore(input) : scoreItem(input),
      item: { kind: "post", row: r, reason: reasonFor({ page: false, followed: isFollowed && r.user_id !== viewerId, engagement: eng, relevance: rel, role, trending: mode === "trending" }) },
    });
  }
  for (const { page, own, followed: pageFollowed } of pages) {
    const at = new Date(page.publishedAt).getTime();
    const rel = relevance(`${page.title} ${page.body}`, ctx.keywords);
    scored.push({
      key: `g-${page.id}`, at,
      score: mode === "following" ? at : scoreItem({ ageHours: (asOf - at) / 3_600_000, engagement: engagementOf(page.likeCount, 0), relevance: rel, followed: pageFollowed, page: true, ownCollege: own }),
      item: { kind: "page", page, reason: reasonFor({ page: true, orgName: page.orgName, followed: false, engagement: 0, relevance: rel, role, trending: false }) },
    });
  }
  scored.sort((a, b) => b.score - a.score || b.at - a.at);

  const slice = scored.slice(offset, offset + FEED_PAGE);
  const hydrated = new Map((await hydratePosts(supabase, service, viewerId, slice.flatMap((c) => (c.item.kind === "post" ? [c.item.row] : [])), blocked)).map((p) => [p.id, p]));
  const items: FeedItem[] = slice.flatMap((c): FeedItem[] => {
    if (c.item.kind === "page") return [{ type: "page", page: c.item.page, reason: c.item.reason }];
    const post = hydrated.get(c.item.row.id);
    return post ? [{ type: "post", post: { ...post, reason: c.item.reason } }] : [];
  });
  return { items, nextCursor: offset + FEED_PAGE < scored.length ? formatCursor(asOf, offset + FEED_PAGE) : null, role };
}

export type { CareerContext };
