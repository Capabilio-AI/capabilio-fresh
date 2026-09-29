import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrgContext } from "./context";
import { untyped, type OrgPostRow } from "./db";
import type { PublicPost } from "./public-org";

/** The posts this member manages, drafts included: everything for admins, otherwise only their own. */
export async function loadManagedPosts(service: SupabaseClient<Database>, ctx: OrgContext): Promise<PublicPost[]> {
  const db = untyped(service);
  let q = db.from("org_posts").select("*").eq("institution_id", ctx.institutionId).order("created_at", { ascending: false }).limit(60);
  if (ctx.kind !== "admin") q = q.eq("author_membership_id", ctx.membershipId);
  const posts = ((await q).data ?? []) as OrgPostRow[];
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const [{ data: likes }, { data: rsvps }] = await Promise.all([
    db.from("org_post_likes").select("post_id").in("post_id", ids),
    db.from("org_event_rsvps").select("post_id").in("post_id", ids),
  ]);
  const count = (rows: { post_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.post_id === id).length;
  return posts.map((p) => ({ ...p, likeCount: count(likes, p.id), likedByViewer: false, rsvpCount: count(rsvps, p.id), rsvpedByViewer: false }));
}
