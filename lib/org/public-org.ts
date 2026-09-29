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
  /** an approved principal/vice-principal/TPO exists — i.e. the Capabilio team has reviewed this organisation */
  verified: boolean;
  studentCount: number;
}

/** Loads an institution by slug for the /o page. `viewerId` null = anonymous. Never returns a private org to a non-member. */
export async function loadPublicOrg(service: SupabaseClient<Database>, slug: string, viewerId: string | null): Promise<PublicOrg | null> {
  const { data: inst } = await service.from("institutions").select("id, name, slug, city, state").eq("slug", slug).maybeSingle();
  if (!inst) return null;
  const db = untyped(service);
  const [{ data: profile }, memberRes, followRes, countRes, verifyRes, studentRes] = await Promise.all([
    db.from("org_profiles").select("*").eq("institution_id", inst.id).maybeSingle(),
    viewerId
      ? service.from("institution_memberships").select("id").eq("institution_id", inst.id).eq("user_id", viewerId).eq("status", "active").maybeSingle()
      : Promise.resolve({ data: null }),
    viewerId ? db.from("org_follows").select("user_id").eq("institution_id", inst.id).eq("user_id", viewerId).maybeSingle() : Promise.resolve({ data: null }),
    db.from("org_follows").select("user_id", { count: "exact", head: true }).eq("institution_id", inst.id),
    service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("institution_id", inst.id).eq("status", "active").in("role", ["principal", "vice_principal", "tpo"] as never[]),
    service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("institution_id", inst.id).eq("role", "student").eq("status", "active"),
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
    verified: (verifyRes.count ?? 0) > 0,
    studentCount: studentRes.count ?? 0,
  };
}

export interface PublicPost extends OrgPostRow {
  likeCount: number;
  likedByViewer: boolean;
  rsvpCount: number;
  rsvpedByViewer: boolean;
}

export interface WallEntry {
  id: string;
  name: string;
  company: string;
  roleTitle: string;
}

/** Placement Wall: ONLY placements the student themself agreed to show; name, company and role — never pay. */
export async function loadPlacementWall(service: SupabaseClient<Database>, institutionId: string): Promise<WallEntry[]> {
  const { data } = await untyped(service).from("org_placements").select("id, student_user_id, company, role_title").eq("institution_id", institutionId).eq("show_on_wall", true).order("confirmed_at", { ascending: false }).limit(30);
  const rows = (data ?? []) as { id: string; student_user_id: string; company: string; role_title: string }[];
  if (rows.length === 0) return [];
  const { data: profiles } = await service.from("profiles").select("id, full_name").in("id", rows.map((r) => r.student_user_id));
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return rows.map((r) => ({ id: r.id, name: names.get(r.student_user_id) ?? "A student", company: r.company, roleTitle: r.role_title }));
}

export async function loadVisiblePosts(service: SupabaseClient<Database>, org: PublicOrg, viewerId: string | null, onlyPostId?: string): Promise<PublicPost[]> {
  const db = untyped(service);
  let q = db.from("org_posts").select("*").eq("institution_id", org.institutionId).eq("status", "published").order("published_at", { ascending: false }).limit(50);
  if (onlyPostId) q = q.eq("id", onlyPostId);
  const posts = ((await q).data ?? []) as OrgPostRow[];
  const visible = posts.filter((post) => postVisibleTo({ post, profilePublic: Boolean(org.profile?.is_public), isMember: org.isMember }));
  if (visible.length === 0) return [];
  const postIds = visible.map((p) => p.id);
  const [{ data: likes }, { data: rsvps }] = await Promise.all([
    db.from("org_post_likes").select("post_id, user_id").in("post_id", postIds),
    db.from("org_event_rsvps").select("post_id, user_id").in("post_id", postIds),
  ]);
  const rows = (likes ?? []) as { post_id: string; user_id: string }[];
  const going = (rsvps ?? []) as { post_id: string; user_id: string }[];
  return visible.map((p) => ({
    ...p,
    likeCount: rows.filter((l) => l.post_id === p.id).length,
    likedByViewer: viewerId ? rows.some((l) => l.post_id === p.id && l.user_id === viewerId) : false,
    rsvpCount: going.filter((r) => r.post_id === p.id).length,
    rsvpedByViewer: viewerId ? going.some((r) => r.post_id === p.id && r.user_id === viewerId) : false,
  }));
}
