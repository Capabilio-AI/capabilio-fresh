import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { loadPeople } from "./people";

type Service = SupabaseClient<Database>;

export interface ReportItem {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  createdAt: string;
  reporter: string;
  /** what was reported, in a line, when it can still be found */
  excerpt: string | null;
  /** the profile to open: the reported person, or the author of the reported content */
  profileId: string | null;
}

const EXCERPT = 200;
const clip = (s: string) => (s.length > EXCERPT ? `${s.slice(0, EXCERPT)}…` : s);

/** The report queue for Capabilio admins, oldest first, each with a short look at what was reported. */
export async function loadReports(service: Service, status: "open" | "reviewed" | "dismissed" = "open"): Promise<ReportItem[]> {
  const db = untyped(service);
  const { data } = await db.from("pulse_reports").select("id, reporter_id, target_type, target_id, reason, details, created_at").eq("status", status).order("created_at", { ascending: true }).limit(100);
  const rows = (data ?? []) as { id: string; reporter_id: string; target_type: string; target_id: string; reason: string; details: string | null; created_at: string }[];
  if (rows.length === 0) return [];
  const ids = (type: string | string[]) => rows.filter((r) => [type].flat().includes(r.target_type)).map((r) => r.target_id);
  const [posts, communityPosts, stories, messages, communities] = await Promise.all([
    ids("post").length ? db.from("posts").select("id, user_id, content").in("id", ids("post")) : { data: [] },
    ids("community_post").length ? db.from("community_posts").select("id, user_id, content").in("id", ids("community_post")) : { data: [] },
    ids("story").length ? db.from("stories").select("id, user_id, body").in("id", ids("story")) : { data: [] },
    ids("message").length ? db.from("dm_messages").select("id, sender_id, body").in("id", ids("message")) : { data: [] },
    ids("community").length ? db.from("communities").select("id, name").in("id", ids("community")) : { data: [] },
  ]);
  const byId = <T extends { id: string }>(r: { data: unknown }) => new Map(((r.data ?? []) as T[]).map((x) => [x.id, x]));
  const p = byId<{ id: string; user_id: string; content: string }>(posts);
  const cp = byId<{ id: string; user_id: string; content: string }>(communityPosts);
  const st = byId<{ id: string; user_id: string; body: string | null }>(stories);
  const ms = byId<{ id: string; sender_id: string; body: string }>(messages);
  const cm = byId<{ id: string; name: string }>(communities);
  const people = await loadPeople(service, rows.map((r) => r.reporter_id));

  return rows.map((r) => {
    let excerpt: string | null = null;
    let profileId: string | null = null;
    if (r.target_type === "user") profileId = r.target_id;
    if (r.target_type === "post" && p.has(r.target_id)) (excerpt = clip(p.get(r.target_id)!.content), (profileId = p.get(r.target_id)!.user_id));
    if (r.target_type === "community_post" && cp.has(r.target_id)) (excerpt = clip(cp.get(r.target_id)!.content), (profileId = cp.get(r.target_id)!.user_id));
    if (r.target_type === "story" && st.has(r.target_id)) (excerpt = st.get(r.target_id)!.body ? clip(st.get(r.target_id)!.body as string) : "Photo story", (profileId = st.get(r.target_id)!.user_id));
    if (r.target_type === "message" && ms.has(r.target_id)) (excerpt = clip(ms.get(r.target_id)!.body), (profileId = ms.get(r.target_id)!.sender_id));
    if (r.target_type === "community" && cm.has(r.target_id)) excerpt = cm.get(r.target_id)!.name;
    return { id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason, details: r.details, createdAt: r.created_at, reporter: people.get(r.reporter_id)?.name ?? "Someone", excerpt: excerpt ?? (r.target_type === "user" ? null : "No longer available"), profileId };
  });
}
