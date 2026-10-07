import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith, canViewStories, followingIds } from "./graph";
import { ownsMedia, removeMedia, signPaths } from "./media";
import { loadPeople, type PersonSummary } from "./people";

type Service = SupabaseClient<Database>;

export const MAX_ACTIVE_STORIES = 20;
export const STORY_TTL_HOURS = 24;
const PURGE_GRACE_MS = 3_600_000;
const PURGE_BATCH = 500;

export interface StoryItem {
  id: string;
  kind: "text" | "image";
  body: string | null;
  imageUrl: string | null;
  theme: number;
  createdAt: string;
  expiresAt: string;
  viewed: boolean;
}
export interface StoryGroup {
  user: PersonSummary;
  isMe: boolean;
  stories: StoryItem[];
  hasUnviewed: boolean;
}

interface StoryRow {
  id: string;
  user_id: string;
  kind: "text" | "image";
  body: string | null;
  image_path: string | null;
  theme: number;
  created_at: string;
  expires_at: string;
}

/** Pure. The viewer's own ring first, then people with something unseen, then the rest — newest activity first within each. */
export function sortGroups(groups: StoryGroup[]): StoryGroup[] {
  const latest = (g: StoryGroup) => g.stories[g.stories.length - 1]?.createdAt ?? "";
  return [...groups].sort((a, b) => Number(b.isMe) - Number(a.isMe) || Number(b.hasUnviewed) - Number(a.hasUnviewed) || latest(b).localeCompare(latest(a)));
}

/** Pure. Rows (oldest first) -> one group per author. Expired rows never get this far; this also drops any that did. */
export function groupStories(rows: StoryRow[], viewed: Set<string>, people: Map<string, PersonSummary>, viewerId: string, urls: Map<string, string>, now = Date.now()): StoryGroup[] {
  const groups = new Map<string, StoryGroup>();
  for (const r of rows) {
    if (new Date(r.expires_at).getTime() <= now) continue;
    const user = people.get(r.user_id);
    if (!user) continue;
    const g = groups.get(r.user_id) ?? { user, isMe: r.user_id === viewerId, stories: [], hasUnviewed: false };
    const seen = r.user_id === viewerId || viewed.has(r.id);
    g.stories.push({ id: r.id, kind: r.kind, body: r.body, imageUrl: r.image_path ? (urls.get(r.image_path) ?? null) : null, theme: r.theme, createdAt: r.created_at, expiresAt: r.expires_at, viewed: seen });
    g.hasUnviewed = g.hasUnviewed || !seen;
    groups.set(r.user_id, g);
  }
  return sortGroups([...groups.values()]);
}

/** The viewer's story tray: their own stories plus those of everyone they follow, active only. */
export async function loadTray(service: Service, viewerId: string): Promise<StoryGroup[]> {
  const db = untyped(service);
  const [following, blocked] = await Promise.all([followingIds(service, viewerId), blockedWith(service, viewerId)]);
  const authors = [viewerId, ...following.filter((id) => !blocked.has(id))];
  const { data } = await db.from("stories").select("id, user_id, kind, body, image_path, theme, created_at, expires_at").in("user_id", authors).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(500);
  const rows = (data ?? []) as StoryRow[];
  if (rows.length === 0) return [];
  const [{ data: views }, people, urls] = await Promise.all([
    db.from("story_views").select("story_id").eq("viewer_id", viewerId).in("story_id", rows.map((r) => r.id)),
    loadPeople(service, rows.map((r) => r.user_id)),
    signPaths(service, rows.map((r) => r.image_path)),
  ]);
  return groupStories(rows, new Set(((views ?? []) as { story_id: string }[]).map((v) => v.story_id)), people, viewerId, urls);
}

export type StoryInput = { kind: "text"; body: string; theme: number } | { kind: "image"; imagePath: string; body?: string };
export type StoryResult = { ok: true; id: string } | { ok: false; status: number; message: string };

export async function createStory(service: Service, userId: string, input: StoryInput): Promise<StoryResult> {
  const db = untyped(service);
  if (input.kind === "image" && !ownsMedia(userId, "story", input.imagePath)) return { ok: false, status: 400, message: "That image wasn't uploaded by you." };
  const { count } = await db.from("stories").select("id", { count: "exact", head: true }).eq("user_id", userId).gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= MAX_ACTIVE_STORIES) return { ok: false, status: 429, message: `You can have ${MAX_ACTIVE_STORIES} stories live at once. Wait for one to expire or delete one.` };
  const row: Record<string, unknown> = input.kind === "text" ? { user_id: userId, kind: "text", body: input.body, theme: input.theme } : { user_id: userId, kind: "image", image_path: input.imagePath, body: input.body?.trim() || null };
  const { data, error } = await db.from("stories").insert(row).select("id").single();
  if (error || !data) return { ok: false, status: 500, message: "Couldn't share your story. Please try again." };
  return { ok: true, id: (data as { id: string }).id };
}

/** Records that the viewer saw a story. Only people allowed to see it, only while it is live, never the owner. */
export async function markViewed(service: Service, viewerId: string, storyId: string): Promise<boolean> {
  const db = untyped(service);
  const { data } = await db.from("stories").select("id, user_id").eq("id", storyId).gt("expires_at", new Date().toISOString()).maybeSingle();
  const story = data as { id: string; user_id: string } | null;
  if (!story || story.user_id === viewerId || !(await canViewStories(service, viewerId, story.user_id))) return false;
  const { error } = await db.from("story_views").upsert({ story_id: storyId, viewer_id: viewerId }, { onConflict: "story_id,viewer_id", ignoreDuplicates: true });
  return !error;
}

export async function deleteStory(service: Service, userId: string, storyId: string): Promise<boolean> {
  const db = untyped(service);
  const { data } = await db.from("stories").select("id, image_path").eq("id", storyId).eq("user_id", userId).maybeSingle();
  if (!data) return false;
  const { error } = await db.from("stories").delete().eq("id", storyId).eq("user_id", userId);
  if (error) return false;
  await removeMedia(service, [(data as { image_path: string | null }).image_path]);
  return true;
}

export interface StoryViewer extends PersonSummary {
  viewedAt: string;
}
/** Who has seen the owner's story; null when it is not theirs. */
export async function storyViewers(service: Service, ownerId: string, storyId: string): Promise<StoryViewer[] | null> {
  const db = untyped(service);
  const { data: story } = await db.from("stories").select("id").eq("id", storyId).eq("user_id", ownerId).maybeSingle();
  if (!story) return null;
  const { data } = await db.from("story_views").select("viewer_id, viewed_at").eq("story_id", storyId).order("viewed_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as { viewer_id: string; viewed_at: string }[];
  const people = await loadPeople(service, rows.map((r) => r.viewer_id));
  return rows.flatMap((r) => (people.has(r.viewer_id) ? [{ ...(people.get(r.viewer_id) as PersonSummary), viewedAt: r.viewed_at }] : []));
}

/** Housekeeping for the daily cron: expired stories are already invisible; this frees their rows and images. */
export async function purgeExpired(service: Service): Promise<number> {
  const db = untyped(service);
  const cutoff = new Date(Date.now() - PURGE_GRACE_MS).toISOString();
  const { data } = await db.from("stories").select("id, image_path").lt("expires_at", cutoff).limit(PURGE_BATCH);
  const rows = (data ?? []) as { id: string; image_path: string | null }[];
  if (rows.length === 0) return 0;
  await removeMedia(service, rows.map((r) => r.image_path));
  await db.from("stories").delete().in("id", rows.map((r) => r.id));
  return rows.length;
}
