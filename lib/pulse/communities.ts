import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { branchKey } from "@/lib/org/branch-scope";
import { kindOf } from "@/lib/org/roles";
import { canModerate, canRemoveMember, derivedAccess, slugify, type AcademicMembership, type CommunityKind, type CommunityRef, type CommunityRole } from "./community-rules";
import { escapeLike } from "./format";
import { loadPeople, type PersonSummary } from "./people";

type Service = SupabaseClient<Database>;

export interface CommunityRow {
  id: string;
  kind: CommunityKind;
  name: string;
  slug: string;
  description: string | null;
  institution_id: string | null;
  branch_key: string | null;
  created_by: string | null;
}
export interface CommunitySummary {
  id: string;
  kind: CommunityKind;
  name: string;
  slug: string;
  description: string | null;
  memberCount: number;
  isMember: boolean;
  role: CommunityRole | null;
}
export interface Access {
  member: boolean;
  role: CommunityRole | null;
  banned: boolean;
}

const COLUMNS = "id, kind, name, slug, description, institution_id, branch_key, created_by";
export const MAX_OWNED_INTEREST = 5;
const DISCOVER_LIMIT = 40;

const ref = (c: CommunityRow): CommunityRef => ({ kind: c.kind, institutionId: c.institution_id, branchKey: c.branch_key });

interface MembershipRow {
  institution_id: string;
  branch: string | null;
  role: string;
  institutions: { name: string } | null;
}
async function loadAcademic(service: Service, userId: string): Promise<(AcademicMembership & { institutionName: string })[]> {
  const { data } = await untyped(service).from("institution_memberships").select("institution_id, branch, role, institutions ( name )").eq("user_id", userId).eq("status", "active");
  return ((data ?? []) as unknown as MembershipRow[]).flatMap((m) => {
    const kind = kindOf(m.role);
    return kind ? [{ institutionId: m.institution_id, branch: m.branch, isStaff: kind !== "student", institutionName: m.institutions?.name ?? "College" }] : [];
  });
}

/** Creates the college and branch communities a person's academic profile entitles them to (idempotent; a lost race is harmless). */
export async function ensureSystemCommunities(service: Service, userId: string): Promise<void> {
  const db = untyped(service);
  for (const m of await loadAcademic(service, userId)) {
    const short = m.institutionId.slice(0, 6);
    const wanted: { kind: CommunityKind; name: string; slug: string; branch_key: string | null }[] = [
      { kind: "college", name: m.institutionName.slice(0, 60), slug: `${slugify(m.institutionName, 56)}-${short}`.slice(0, 70), branch_key: null },
    ];
    if (branchKey(m.branch)) wanted.push({ kind: "branch", name: `${(m.branch as string).trim()} · ${m.institutionName}`.slice(0, 60), slug: `${slugify(`${m.branch} ${m.institutionName}`, 56)}-${short}`.slice(0, 70), branch_key: branchKey(m.branch) });
    for (const w of wanted) {
      let q = db.from("communities").select("id", { head: true, count: "exact" }).eq("kind", w.kind).eq("institution_id", m.institutionId);
      if (w.branch_key) q = q.eq("branch_key", w.branch_key);
      if (((await q).count ?? 0) > 0) continue;
      const { error } = await db.from("communities").insert({ kind: w.kind, name: w.name, slug: w.slug, institution_id: m.institutionId, branch_key: w.branch_key });
      if (error && error.code !== "23505") console.error("[communities] ensure failed:", error.message);
    }
  }
}

export async function accessFor(service: Service, userId: string, community: CommunityRow, academic?: AcademicMembership[]): Promise<Access> {
  const db = untyped(service);
  if (community.kind === "interest") {
    const [{ data: row }, { data: ban }] = await Promise.all([
      db.from("community_members").select("role").eq("community_id", community.id).eq("user_id", userId).maybeSingle(),
      db.from("community_bans").select("user_id").eq("community_id", community.id).eq("user_id", userId).maybeSingle(),
    ]);
    const role = (row as { role: CommunityRole } | null)?.role ?? null;
    return { member: Boolean(role) && !ban, role: ban ? null : role, banned: Boolean(ban) };
  }
  const d = derivedAccess(ref(community), academic ?? (await loadAcademic(service, userId)));
  return { ...d, banned: false };
}

async function memberCount(service: Service, c: CommunityRow): Promise<number> {
  const db = untyped(service);
  if (c.kind === "interest") return (await db.from("community_members").select("user_id", { head: true, count: "exact" }).eq("community_id", c.id)).count ?? 0;
  let q = db.from("institution_memberships").select("id", { head: true, count: "exact" }).eq("institution_id", c.institution_id).eq("status", "active");
  if (c.kind === "branch" && c.branch_key) q = q.ilike("branch", escapeLike(c.branch_key));
  return (await q).count ?? 0;
}

async function summarise(service: Service, userId: string, c: CommunityRow, academic: AcademicMembership[]): Promise<CommunitySummary> {
  const [access, count] = await Promise.all([accessFor(service, userId, c, academic), memberCount(service, c)]);
  return { id: c.id, kind: c.kind, name: c.name, slug: c.slug, description: c.description, memberCount: count, isMember: access.member, role: access.role };
}

/** Your communities (college, branch, ones you joined) and interest communities to discover. */
export async function listCommunities(service: Service, userId: string): Promise<{ mine: CommunitySummary[]; discover: CommunitySummary[] }> {
  await ensureSystemCommunities(service, userId);
  const db = untyped(service);
  const academic = await loadAcademic(service, userId);
  const institutions = [...new Set(academic.map((a) => a.institutionId))];
  const [{ data: system }, { data: joined }, { data: interest }] = await Promise.all([
    institutions.length ? db.from("communities").select(COLUMNS).in("institution_id", institutions).is("archived_at", null) : Promise.resolve({ data: [] }),
    db.from("community_members").select("community_id").eq("user_id", userId),
    db.from("communities").select(COLUMNS).eq("kind", "interest").is("archived_at", null).order("created_at", { ascending: true }).limit(DISCOVER_LIMIT),
  ]);
  const joinedIds = new Set(((joined ?? []) as { community_id: string }[]).map((j) => j.community_id));
  const sys = ((system ?? []) as CommunityRow[]).filter((c) => derivedAccess(ref(c), academic).member);
  const interests = (interest ?? []) as CommunityRow[];
  const summaries = await Promise.all([...sys, ...interests].map((c) => summarise(service, userId, c, academic)));
  const rank = { college: 0, branch: 1, interest: 2 } as const;
  const mine = summaries.filter((s) => s.isMember).sort((a, b) => rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name));
  return { mine, discover: summaries.filter((s) => !s.isMember && s.kind === "interest" && !joinedIds.has(s.id)) };
}

export async function getCommunityBySlug(service: Service, userId: string, slug: string): Promise<{ community: CommunityRow; summary: CommunitySummary; access: Access } | null> {
  const { data } = await untyped(service).from("communities").select(COLUMNS).eq("slug", slug).is("archived_at", null).maybeSingle();
  const community = data as CommunityRow | null;
  if (!community) return null;
  const academic = await loadAcademic(service, userId);
  const access = await accessFor(service, userId, community, academic);
  // a college or branch community is for its own people: anyone else gets "not found", never a hint it exists
  if (community.kind !== "interest" && !access.member) return null;
  return { community, access, summary: await summarise(service, userId, community, academic) };
}

export type Result = { ok: true } | { ok: false; status: number; message: string };
const fail = (status: number, message: string): Result => ({ ok: false, status, message });

export async function joinCommunity(service: Service, userId: string, community: CommunityRow): Promise<Result> {
  if (community.kind !== "interest") return fail(400, "You're already part of this community through your college.");
  const access = await accessFor(service, userId, community);
  if (access.banned) return fail(403, "You can't join this community.");
  const { error } = await untyped(service).from("community_members").upsert({ community_id: community.id, user_id: userId, role: "member" }, { onConflict: "community_id,user_id", ignoreDuplicates: true });
  return error ? fail(500, "Couldn't join. Please try again.") : { ok: true };
}

export async function leaveCommunity(service: Service, userId: string, community: CommunityRow): Promise<Result> {
  if (community.kind !== "interest") return fail(400, "You can't leave your college communities.");
  const access = await accessFor(service, userId, community);
  if (access.role === "owner") return fail(409, "You started this community, so you can't leave it.");
  const { error } = await untyped(service).from("community_members").delete().eq("community_id", community.id).eq("user_id", userId);
  return error ? fail(500, "Couldn't leave. Please try again.") : { ok: true };
}

export async function createInterestCommunity(service: Service, userId: string, input: { name: string; description?: string }): Promise<{ ok: true; slug: string } | { ok: false; status: number; message: string }> {
  const db = untyped(service);
  const { count } = await db.from("communities").select("id", { head: true, count: "exact" }).eq("kind", "interest").eq("created_by", userId).is("archived_at", null);
  if ((count ?? 0) >= MAX_OWNED_INTEREST) return { ok: false, status: 429, message: `You can run up to ${MAX_OWNED_INTEREST} communities.` };
  const base = slugify(input.name, 60);
  for (let n = 0; n < 4; n++) {
    const slug = n === 0 ? base : `${base.slice(0, 64)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await db.from("communities").insert({ kind: "interest", name: input.name, slug, description: input.description || null, created_by: userId }).select("id").single();
    if (!error && data) {
      await db.from("community_members").insert({ community_id: (data as { id: string }).id, user_id: userId, role: "owner" });
      return { ok: true, slug };
    }
    if (error?.code === "23505" && /name/i.test(`${error.message} ${error.details ?? ""}`)) return { ok: false, status: 409, message: "A community with that name already exists." };
    if (error?.code !== "23505") break;
  }
  return { ok: false, status: 500, message: "Couldn't create the community. Please try again." };
}

export interface CommunityMember extends PersonSummary {
  communityRole: CommunityRole;
}
/** Members of an interest community (derived communities list nobody: their membership is the college's). */
export async function listMembers(service: Service, community: CommunityRow, limit = 40): Promise<CommunityMember[]> {
  if (community.kind !== "interest") return [];
  const { data } = await untyped(service).from("community_members").select("user_id, role").eq("community_id", community.id).order("joined_at", { ascending: true }).limit(limit);
  const rows = (data ?? []) as { user_id: string; role: CommunityRole }[];
  const people = await loadPeople(service, rows.map((r) => r.user_id));
  return rows.flatMap((r) => (people.has(r.user_id) ? [{ ...(people.get(r.user_id) as PersonSummary), communityRole: r.role }] : []));
}

/** Removes a member and bars them from rejoining. Moderators remove members; owners also remove moderators. */
export async function removeMember(service: Service, actorId: string, community: CommunityRow, targetId: string): Promise<Result> {
  if (community.kind !== "interest") return fail(400, "Members of college communities are managed by the college.");
  const db = untyped(service);
  const [actor, { data: target }] = await Promise.all([accessFor(service, actorId, community), db.from("community_members").select("role").eq("community_id", community.id).eq("user_id", targetId).maybeSingle()]);
  const targetRole = (target as { role: CommunityRole } | null)?.role;
  if (!targetRole) return fail(404, "That person isn't a member.");
  if (!canRemoveMember(actor.role, targetRole)) return fail(403, "You can't remove this person.");
  await db.from("community_bans").upsert({ community_id: community.id, user_id: targetId, banned_by: actorId }, { onConflict: "community_id,user_id", ignoreDuplicates: true });
  const { error } = await db.from("community_members").delete().eq("community_id", community.id).eq("user_id", targetId);
  return error ? fail(500, "Couldn't remove them. Please try again.") : { ok: true };
}

export { canModerate };
