import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith, followingIds } from "./graph";
import { hashtagsOf } from "./format";
import { loadPeople, type PersonSummary } from "./people";

type Service = SupabaseClient<Database>;

const TRENDING_DAYS = 7;
const TRENDING_SAMPLE = 1000;
export const TRENDING_COUNT = 8;
export const SUGGESTION_COUNT = 5;

export interface TrendingTag {
  tag: string;
  posts: number;
}

/** Pure. Most-used hashtags, one count per post, ties broken alphabetically. */
export function rankTags(contents: string[], limit = TRENDING_COUNT): TrendingTag[] {
  const counts = new Map<string, number>();
  for (const c of contents) for (const tag of hashtagsOf(c)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([tag, posts]) => ({ tag, posts })).sort((a, b) => b.posts - a.posts || a.tag.localeCompare(b.tag)).slice(0, limit);
}

export async function trendingTags(service: Service): Promise<TrendingTag[]> {
  const since = new Date(Date.now() - TRENDING_DAYS * 86_400_000).toISOString();
  const { data } = await untyped(service).from("posts").select("content").gt("created_at", since).order("created_at", { ascending: false }).limit(TRENDING_SAMPLE);
  return rankTags(((data ?? []) as { content: string }[]).map((r) => r.content));
}

export interface Suggestion extends PersonSummary {
  reason: string;
}

/** People worth following: your college first, then your branch, then anyone discoverable. Never yourself, anyone followed, or anyone blocked. */
export async function suggestPeople(service: Service, viewerId: string, limit = SUGGESTION_COUNT): Promise<Suggestion[]> {
  const db = untyped(service);
  const [following, blocked, { data: mine }] = await Promise.all([
    followingIds(service, viewerId),
    blockedWith(service, viewerId),
    db.from("institution_memberships").select("institution_id, branch").eq("user_id", viewerId).eq("status", "active").order("created_at", { ascending: false }).limit(1),
  ]);
  const skip = new Set([viewerId, ...following, ...blocked]);
  const me = ((mine ?? []) as { institution_id: string; branch: string | null }[])[0];
  const picked = new Map<string, string>();

  if (me) {
    const { data } = await db.from("institution_memberships").select("user_id, branch").eq("institution_id", me.institution_id).eq("status", "active").order("created_at", { ascending: false }).limit(200);
    for (const m of (data ?? []) as { user_id: string; branch: string | null }[]) {
      if (skip.has(m.user_id) || picked.has(m.user_id)) continue;
      picked.set(m.user_id, me.branch && m.branch && m.branch.trim().toLowerCase() === me.branch.trim().toLowerCase() ? "Same branch" : "Your college");
    }
  }
  const ranked = [...picked].sort((a, b) => Number(b[1] === "Same branch") - Number(a[1] === "Same branch")).slice(0, limit * 3);
  const candidates = new Map(ranked);
  if (candidates.size < limit) {
    const { data } = await db.from("profiles").select("id").eq("pulse_discoverable", true).order("created_at", { ascending: false }).limit(60);
    for (const p of (data ?? []) as { id: string }[]) if (!skip.has(p.id) && !candidates.has(p.id)) candidates.set(p.id, "On Capabilio");
  }
  const people = await loadPeople(service, [...candidates.keys()]);
  const { data: hidden } = await db.from("profiles").select("id").in("id", [...candidates.keys()]).eq("pulse_discoverable", false);
  const optedOut = new Set(((hidden ?? []) as { id: string }[]).map((h) => h.id));
  return [...candidates]
    .filter(([id]) => people.has(id) && !optedOut.has(id) && people.get(id)?.name)
    .slice(0, limit)
    .map(([id, reason]) => ({ ...(people.get(id) as PersonSummary), reason }));
}
