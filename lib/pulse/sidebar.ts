import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith, followingIds } from "./graph";
import { hashtagsOf } from "./format";
import { loadCareerContext } from "./career-context";
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

/** Pure. Most-used tags, one count per post, ties broken alphabetically. */
export function rankTagLists(lists: string[][], limit = TRENDING_COUNT): TrendingTag[] {
  const counts = new Map<string, number>();
  for (const list of lists) for (const tag of new Set(list)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([tag, posts]) => ({ tag, posts })).sort((a, b) => b.posts - a.posts || a.tag.localeCompare(b.tag)).slice(0, limit);
}

export async function trendingTags(service: Service): Promise<TrendingTag[]> {
  const since = new Date(Date.now() - TRENDING_DAYS * 86_400_000).toISOString();
  const { data } = await untyped(service).from("posts").select("tags").gt("created_at", since).order("created_at", { ascending: false }).limit(TRENDING_SAMPLE);
  return rankTagLists(((data ?? []) as { tags: string[] }[]).map((r) => r.tags ?? []));
}

export interface Suggestion extends PersonSummary {
  /** why this person is suggested: "Your TPO", "Same branch", "Also aiming for AI/ML Engineer" */
  reason: string;
}

export interface Candidate {
  reason: string;
  /** lower ranks first */
  rank: number;
}

const LEADERSHIP: Record<string, string> = { principal: "Principal of your college", vice_principal: "Vice Principal of your college", tpo: "Your TPO" };

/** Pure. Keeps the best-ranked reason when a person qualifies in several ways. */
export function addCandidate(map: Map<string, Candidate>, id: string, c: Candidate): void {
  const prev = map.get(id);
  if (!prev || c.rank < prev.rank) map.set(id, c);
}

/** Pure. Which of a mentor's expertise tags matches the person's career vocabulary, if any. */
export function matchingExpertise(expertise: readonly string[], keywords: readonly { term: string }[]): string | null {
  const lower = keywords.map((k) => k.term);
  return expertise.find((e) => lower.some((k) => e.toLowerCase().includes(k) || k.includes(e.toLowerCase()))) ?? null;
}

/**
 * People worth following, and only people with a reason: your college's leadership, mentors in your field, people on your branch or in
 * your college, and people aiming for the same career. Nobody is suggested just for being on Capabilio. Never yourself, anyone you follow,
 * anyone blocked, or anyone who turned discovery off.
 */
export async function suggestPeople(service: Service, viewerId: string, limit = SUGGESTION_COUNT): Promise<Suggestion[]> {
  const db = untyped(service);
  const [following, blocked, ctx, { data: mine }, { data: intent }] = await Promise.all([
    followingIds(service, viewerId),
    blockedWith(service, viewerId),
    loadCareerContext(service, viewerId),
    db.from("institution_memberships").select("institution_id, branch").eq("user_id", viewerId).eq("status", "active").order("created_at", { ascending: false }).limit(1),
    db.from("student_career_intent").select("primary_career_id").eq("student_id", viewerId).maybeSingle(),
  ]);
  const skip = new Set([viewerId, ...following, ...blocked]);
  const me = ((mine ?? []) as { institution_id: string; branch: string | null }[])[0];
  const picked = new Map<string, Candidate>();
  const take = (id: string, c: Candidate) => !skip.has(id) && addCandidate(picked, id, c);

  const [{ data: college }, { data: mentors }, { data: peers }] = await Promise.all([
    me ? db.from("institution_memberships").select("user_id, role, branch").eq("institution_id", me.institution_id).eq("status", "active").order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
    ctx.keywords.length ? db.from("mentor_profiles").select("user_id, expertise").eq("status", "approved").limit(200) : Promise.resolve({ data: [] }),
    intent?.primary_career_id ? db.from("student_career_intent").select("student_id").eq("primary_career_id", intent.primary_career_id).eq("is_exploring", false).neq("student_id", viewerId).limit(100) : Promise.resolve({ data: [] }),
  ]);
  const myBranch = me?.branch?.trim().toLowerCase();
  for (const m of (college ?? []) as { user_id: string; role: string; branch: string | null }[]) {
    if (LEADERSHIP[m.role]) take(m.user_id, { reason: LEADERSHIP[m.role], rank: 0 });
    else if (m.role === "hod" && myBranch && m.branch?.trim().toLowerCase() === myBranch) take(m.user_id, { reason: "Your HoD", rank: 0 });
    else if (m.role === "student" && myBranch && m.branch?.trim().toLowerCase() === myBranch) take(m.user_id, { reason: "Same branch", rank: 3 });
    else if (m.role === "student") take(m.user_id, { reason: "Your college", rank: 4 });
  }
  for (const m of (mentors ?? []) as { user_id: string; expertise: string[] }[]) {
    const topic = matchingExpertise(m.expertise, ctx.keywords);
    if (topic) take(m.user_id, { reason: `Mentor in ${topic}`, rank: 1 });
  }
  const goal = ctx.roles[0];
  for (const p of (peers ?? []) as { student_id: string }[]) take(p.student_id, { reason: goal ? `Also aiming for ${goal}` : "Same career goal", rank: 2 });

  const ranked = [...picked].sort((a, b) => a[1].rank - b[1].rank).slice(0, limit * 4).map(([id]) => id);
  if (ranked.length === 0) return [];
  const [people, { data: hidden }] = await Promise.all([loadPeople(service, ranked), db.from("profiles").select("id").in("id", ranked).eq("pulse_discoverable", false)]);
  const optedOut = new Set(((hidden ?? []) as { id: string }[]).map((h) => h.id));
  return ranked
    .filter((id) => people.has(id) && !optedOut.has(id) && people.get(id)?.name)
    .slice(0, limit)
    .map((id) => ({ ...(people.get(id) as PersonSummary), reason: (picked.get(id) as Candidate).reason }));
}

export interface SuggestedPage {
  slug: string;
  name: string;
  following: boolean;
}

/** Your own college's page, if it has one you can see, so it can be followed from the sidebar. */
export async function suggestPages(service: Service, viewerId: string): Promise<SuggestedPage[]> {
  const db = untyped(service);
  const { data: memberships } = await service.from("institution_memberships").select("institution_id").eq("user_id", viewerId).eq("status", "active");
  const ids = [...new Set((memberships ?? []).map((m) => m.institution_id))];
  if (ids.length === 0) return [];
  const [{ data: insts }, { data: follows }] = await Promise.all([service.from("institutions").select("id, name, slug").in("id", ids), db.from("org_follows").select("institution_id").eq("user_id", viewerId).in("institution_id", ids)]);
  const followed = new Set(((follows ?? []) as { institution_id: string }[]).map((f) => f.institution_id));
  return (insts ?? []).map((i) => ({ slug: i.slug, name: i.name, following: followed.has(i.id) }));
}
