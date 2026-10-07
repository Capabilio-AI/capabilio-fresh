import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith, followingIds } from "./graph";
import { needsReReview, type MentorApplication } from "./mentor-schema";
import { loadPeople, type PersonSummary } from "./people";

type Service = SupabaseClient<Database>;

export type MentorStatus = "pending" | "approved" | "rejected" | "suspended";
export interface MentorCard extends PersonSummary {
  mentorHeadline: string;
  bio: string;
  expertise: string[];
  company: string | null;
  roleTitle: string | null;
  yearsExperience: number | null;
  availability: string | null;
  isAccepting: boolean;
  following: boolean;
}
export interface MyMentorProfile extends MentorApplication {
  status: MentorStatus;
  isAccepting: boolean;
  reviewNote: string | null;
}

interface Row {
  user_id: string;
  status: MentorStatus;
  headline: string;
  bio: string;
  expertise: string[];
  company: string | null;
  role_title: string | null;
  years_experience: number | null;
  availability: string | null;
  is_accepting: boolean;
  review_note: string | null;
}
const COLUMNS = "user_id, status, headline, bio, expertise, company, role_title, years_experience, availability, is_accepting, review_note";

const toApplication = (r: Row): MentorApplication => ({ headline: r.headline, bio: r.bio, expertise: r.expertise, company: r.company ?? undefined, roleTitle: r.role_title ?? undefined, yearsExperience: r.years_experience ?? undefined, availability: r.availability ?? undefined });

export async function getMyMentorProfile(service: Service, userId: string): Promise<MyMentorProfile | null> {
  const { data } = await untyped(service).from("mentor_profiles").select(COLUMNS).eq("user_id", userId).maybeSingle();
  const r = data as Row | null;
  return r ? { ...toApplication(r), status: r.status, isAccepting: r.is_accepting, reviewNote: r.review_note } : null;
}

export type SaveResult = { ok: true; status: MentorStatus } | { ok: false; status: number; message: string };

/**
 * Apply, or edit an existing profile. A new application is pending. An approved mentor who changes the public text goes back to pending
 * (people trust the badge, so the words behind it are reviewed); changing only availability keeps the approval. Rejected and suspended
 * profiles cannot be re-submitted by editing: that is a decision for Capabilio.
 */
export async function saveMentorApplication(service: Service, userId: string, input: MentorApplication): Promise<SaveResult> {
  const db = untyped(service);
  const existing = await getMyMentorProfile(service, userId);
  const fields = { headline: input.headline, bio: input.bio, expertise: input.expertise, company: input.company ?? null, role_title: input.roleTitle ?? null, years_experience: input.yearsExperience ?? null, availability: input.availability ?? null, updated_at: new Date().toISOString() };
  if (!existing) {
    const { error } = await db.from("mentor_profiles").insert({ user_id: userId, status: "pending", ...fields });
    return error ? { ok: false, status: 500, message: "Couldn't send your application. Please try again." } : { ok: true, status: "pending" };
  }
  if (existing.status === "rejected" || existing.status === "suspended") return { ok: false, status: 403, message: "This application was closed by the Capabilio team. Contact support to discuss it." };
  const status: MentorStatus = existing.status === "approved" && !needsReReview(existing, input) ? "approved" : "pending";
  const { error } = await db.from("mentor_profiles").update({ ...fields, status, ...(status === "pending" ? { reviewed_at: null, reviewed_by: null } : {}) }).eq("user_id", userId);
  return error ? { ok: false, status: 500, message: "Couldn't save. Please try again." } : { ok: true, status };
}

export async function setAccepting(service: Service, userId: string, accepting: boolean): Promise<boolean> {
  const { data, error } = await untyped(service).from("mentor_profiles").update({ is_accepting: accepting }).eq("user_id", userId).eq("status", "approved").select("user_id");
  return !error && (data?.length ?? 0) > 0;
}

/** Approved mentors, optionally narrowed by a name or expertise search and one expertise tag. Blocked people are left out. */
export async function listMentors(service: Service, viewerId: string, opts: { q?: string; tag?: string } = {}): Promise<MentorCard[]> {
  const db = untyped(service);
  let query = db.from("mentor_profiles").select(COLUMNS).eq("status", "approved").order("updated_at", { ascending: false }).limit(120);
  if (opts.tag) query = query.contains("expertise", [opts.tag]);
  const [{ data }, blocked, following] = await Promise.all([query, blockedWith(service, viewerId), followingIds(service, viewerId)]);
  const rows = ((data ?? []) as Row[]).filter((r) => r.user_id !== viewerId && !blocked.has(r.user_id));
  const people = await loadPeople(service, rows.map((r) => r.user_id));
  const followed = new Set(following);
  const q = opts.q?.trim().toLowerCase();
  return rows.flatMap((r) => {
    const p = people.get(r.user_id);
    if (!p) return [];
    const hay = [p.name, r.headline, r.company, ...r.expertise].join(" ").toLowerCase();
    if (q && !hay.includes(q)) return [];
    return [{ ...p, mentorHeadline: r.headline, bio: r.bio, expertise: r.expertise, company: r.company, roleTitle: r.role_title, yearsExperience: r.years_experience, availability: r.availability, isAccepting: r.is_accepting, following: followed.has(r.user_id) }];
  });
}

/** The expertise tags in use across approved mentors, most common first, for the filter chips. */
export async function expertiseTags(service: Service, limit = 14): Promise<string[]> {
  const { data } = await untyped(service).from("mentor_profiles").select("expertise").eq("status", "approved").limit(500);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { expertise: string[] }[]) for (const t of r.expertise) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([t]) => t);
}

export interface MentorApplicationRow extends PersonSummary {
  status: MentorStatus;
  application: MentorApplication;
  submittedAt: string;
}

/** For the Capabilio admin queue. */
export async function listApplications(service: Service, status: MentorStatus): Promise<MentorApplicationRow[]> {
  const { data } = await untyped(service).from("mentor_profiles").select(`${COLUMNS}, updated_at`).eq("status", status).order("updated_at", { ascending: true }).limit(100);
  const rows = (data ?? []) as (Row & { updated_at: string })[];
  const people = await loadPeople(service, rows.map((r) => r.user_id));
  return rows.flatMap((r) => (people.has(r.user_id) ? [{ ...(people.get(r.user_id) as PersonSummary), status: r.status, application: toApplication(r), submittedAt: r.updated_at }] : []));
}

export async function reviewMentor(service: Service, adminId: string, userId: string, decision: "approve" | "reject" | "suspend", note: string | null): Promise<boolean> {
  const status: MentorStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "suspended";
  const { data, error } = await untyped(service).from("mentor_profiles").update({ status, review_note: note, reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq("user_id", userId).select("user_id");
  return !error && (data?.length ?? 0) > 0;
}

