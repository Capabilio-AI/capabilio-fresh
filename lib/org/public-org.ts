import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped, type OrgPostRow, type OrgProfileRow } from "./db";
import { postVisibleTo } from "./presence";

export interface PublicOrg {
  institutionId: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  profile: OrgProfileRow | null;
  isMember: boolean;
  isFollowing: boolean;
  followerCount: number;
}

/** Loads an institution by slug for the /o page. `viewerId` null = anonymous. Never returns a private org to a non-member. */
export async function loadPublicOrg(service: SupabaseClient<Database>, slug: string, viewerId: string | null): Promise<PublicOrg | null> {
  const { data: inst } = await service.from("institutions").select("id, name, slug, city, state").eq("slug", slug).maybeSingle();
  if (!inst) return null;
  const db = untyped(service);
  const [{ data: profile }, memberRes, followRes, countRes] = await Promise.all([
    db.from("org_profiles").select("*").eq("institution_id", inst.id).maybeSingle(),
    viewerId
      ? service.from("institution_memberships").select("id").eq("institution_id", inst.id).eq("user_id", viewerId).eq("status", "active").maybeSingle()
      : Promise.resolve({ data: null }),
    viewerId ? db.from("org_follows").select("user_id").eq("institution_id", inst.id).eq("user_id", viewerId).maybeSingle() : Promise.resolve({ data: null }),
    db.from("org_follows").select("user_id", { count: "exact", head: true }).eq("institution_id", inst.id),
  ]);
  const isMember = Boolean(memberRes.data);
  const p = (profile as OrgProfileRow | null) ?? null;
  if (!isMember && !p?.is_public) return null;
  return {
    institutionId: inst.id,
    name: inst.name,
    slug: inst.slug,
    city: inst.city,
    state: inst.state,
    profile: p,
    isMember,
    isFollowing: Boolean(followRes.data),
    followerCount: countRes.count ?? 0,
  };
}

export interface PublicPost extends OrgPostRow {
  likeCount: number;
  likedByViewer: boolean;
}

export async function loadVisiblePosts(service: SupabaseClient<Database>, org: PublicOrg, viewerId: string | null, onlyPostId?: string): Promise<PublicPost[]> {
  const db = untyped(service);
  let q = db.from("org_posts").select("*").eq("institution_id", org.institutionId).eq("status", "published").order("published_at", { ascending: false }).limit(50);
  if (onlyPostId) q = q.eq("id", onlyPostId);
  const posts = ((await q).data ?? []) as OrgPostRow[];
  const visible = posts.filter((post) => postVisibleTo({ post, profilePublic: Boolean(org.profile?.is_public), isMember: org.isMember }));
  if (visible.length === 0) return [];
  const { data: likes } = await db.from("org_post_likes").select("post_id, user_id").in("post_id", visible.map((p) => p.id));
  const rows = (likes ?? []) as { post_id: string; user_id: string }[];
  return visible.map((p) => ({
    ...p,
    likeCount: rows.filter((l) => l.post_id === p.id).length,
    likedByViewer: viewerId ? rows.some((l) => l.post_id === p.id && l.user_id === viewerId) : false,
  }));
}
