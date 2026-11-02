import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { RECORD_COLUMNS, recordFromRow } from "@/lib/evidence/records";
import { TOOL_LABEL } from "@/lib/arena/attempt-evidence";
import { getPortfolioData } from "@/lib/portfolio/data";
import type { EducationEntry } from "@/lib/dashboard/education";
import type { SkillProficiency } from "@/lib/proficiency/by-skill";
import type { StudentRoleReadiness } from "@/lib/proficiency/readiness-load";
import { expiryFrom, newShareToken, shareState, validateShareRequest, type ShareRequest, type ShareState } from "./share";

type Service = SupabaseClient<any>; // the tables postdate the generated types

export interface ShareRow {
  id: string;
  label: string;
  token: string;
  attemptIds: string[];
  includeContact: boolean;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  state: ShareState;
}

interface DbShare {
  id: string; user_id: string; token: string; label: string; attempt_ids: string[]; include_contact: boolean; expires_at: string; revoked_at: string | null; view_count: number; last_viewed_at: string | null; created_at: string;
}
const COLUMNS = "id, user_id, token, label, attempt_ids, include_contact, expires_at, revoked_at, view_count, last_viewed_at, created_at";
const toRow = (r: DbShare, now: Date): ShareRow => ({
  id: r.id, label: r.label, token: r.token, attemptIds: r.attempt_ids, includeContact: r.include_contact, expiresAt: r.expires_at, revokedAt: r.revoked_at, viewCount: r.view_count, lastViewedAt: r.last_viewed_at, createdAt: r.created_at,
  state: shareState({ expiresAt: r.expires_at, revokedAt: r.revoked_at }, now),
});

/** Ids of the student's sealed records: the only things a share may contain. */
export async function ownSealedIds(service: Service, userId: string): Promise<Set<string>> {
  const { data } = await untyped(service).from("evidence_records").select("attempt_id").eq("user_id", userId);
  return new Set(((data ?? []) as { attempt_id: string }[]).map((r) => r.attempt_id));
}

export async function createShare(service: Service, userId: string, req: ShareRequest, now = new Date()): Promise<{ ok: true; share: ShareRow } | { ok: false; error: string }> {
  const checked = validateShareRequest(req, await ownSealedIds(service, userId));
  if (!checked.ok) return checked;
  const v = checked.value;
  const { data, error } = await untyped(service)
    .from("recruiter_shares")
    .insert({ user_id: userId, token: newShareToken(), label: v.label, attempt_ids: v.attemptIds, include_contact: v.includeContact, expires_at: expiryFrom(v.days, now) })
    .select(COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: "Could not create the share. Try again." };
  return { ok: true, share: toRow(data as DbShare, now) };
}

export async function listShares(service: Service, userId: string, now = new Date()): Promise<ShareRow[]> {
  const { data, error } = await untyped(service).from("recruiter_shares").select(COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) return [];
  return ((data ?? []) as DbShare[]).map((r) => toRow(r, now));
}

/** Only the owner can revoke. Revoking twice is harmless. */
export async function revokeShare(service: Service, userId: string, shareId: string, now = new Date()): Promise<boolean> {
  const { data, error } = await untyped(service).from("recruiter_shares").update({ revoked_at: now.toISOString() }).eq("id", shareId).eq("user_id", userId).is("revoked_at", null).select("id");
  return !error && ((data ?? []) as unknown[]).length > 0;
}

/** The share a link points to, or null when the link is unknown. The state says whether it still opens anything. */
export async function findShareByToken(service: Service, token: string, now = new Date()): Promise<(ShareRow & { userId: string }) | null> {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  const { data, error } = await untyped(service).from("recruiter_shares").select(COLUMNS).eq("token", token).maybeSingle();
  if (error || !data) return null;
  return { ...toRow(data as DbShare, now), userId: (data as DbShare).user_id };
}

export interface PackSample {
  attemptId: string;
  title: string;
  areaName: string | null;
  toolLabel: string | null;
  difficulty: string;
  completedAt: string;
  submissions: number;
  explained: boolean;
  explanationScore: number | null;
  fingerprint: string;
  intact: boolean;
}

export interface RecruiterPack {
  share: { label: string; expiresAt: string };
  candidate: { name: string | null; college: string | null; education: string | null; targetRole: string | null; contact: { email: string; phone: string | null } | null };
  readiness: StudentRoleReadiness | null;
  skills: SkillProficiency[];
  samples: PackSample[];
  /** every graded task the student has passed, so a reader sees how much of it this share includes */
  gradedTotal: number;
}

/**
 * What a recruiter sees for one share: the candidate, readiness for the target role, skill levels with their basis, and the sealed work samples the student chose.
 * Counts the view. Returns null for an unknown link; an expired or revoked link returns its state and no data at all.
 */
export async function loadRecruiterPack(service: Service, token: string, opts: { countView?: boolean; now?: Date } = {}): Promise<{ state: Exclude<ShareState, "active"> } | { state: "active"; pack: RecruiterPack } | null> {
  const now = opts.now ?? new Date();
  const share = await findShareByToken(service, token, now);
  if (!share) return null;
  if (share.state !== "active") return { state: share.state };

  const [{ data: rows }, portfolio] = await Promise.all([
    untyped(service).from("evidence_records").select(RECORD_COLUMNS).eq("user_id", share.userId).in("attempt_id", share.attemptIds),
    getPortfolioData(service, share.userId, { publicView: true }),
  ]);
  const records = ((rows ?? []) as Parameters<typeof recordFromRow>[0][]).map(recordFromRow);
  const order = new Map(share.attemptIds.map((id, i) => [id, i]));
  const samples: PackSample[] = records
    .sort((a, b) => (b.content.completedAt > a.content.completedAt ? 1 : -1) || (order.get(a.attemptId)! - order.get(b.attemptId)!))
    .map((r) => ({
      attemptId: r.attemptId, title: r.content.title, areaName: r.content.areaName, toolLabel: r.content.toolType ? (TOOL_LABEL[r.content.toolType] ?? null) : null, difficulty: r.content.difficulty, completedAt: r.content.completedAt,
      submissions: r.content.submissions, explained: r.content.explained, explanationScore: r.content.explanationScore, fingerprint: r.fingerprint, intact: r.intact,
    }));

  if (opts.countView !== false) {
    await untyped(service).from("recruiter_shares").update({ view_count: share.viewCount + 1, last_viewed_at: now.toISOString() }).eq("id", share.id);
  }

  const edu: EducationEntry | undefined = portfolio.education[0];
  const eduLine = edu ? [edu.degree, edu.fieldOfStudy ?? edu.branch, edu.endYear ? `class of ${edu.endYear}` : null].filter(Boolean).join(", ") || null : null;
  return {
    state: "active",
    pack: {
      share: { label: share.label, expiresAt: share.expiresAt },
      candidate: { name: portfolio.viewer.fullName, college: edu?.institutionName ?? portfolio.viewer.collegeName, education: eduLine, targetRole: portfolio.statedRole, contact: share.includeContact ? portfolio.profile.contact : null },
      readiness: portfolio.roleReadiness,
      skills: portfolio.proficiency,
      samples,
      gradedTotal: portfolio.arenaWork.reduce((n, r) => n + r.verifiedCount, 0),
    },
  };
}
