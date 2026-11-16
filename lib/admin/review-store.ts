import { adminDb, rowsOf } from "./db";
import type { Decision } from "./rules";

export type SubjectType = "mentor" | "organisation" | "executive" | "professional";
export type EmailState = "sent" | "not_configured" | "failed" | "none";

export interface ReviewRow {
  id: string; subjectType: SubjectType; subjectId: string; userId: string | null; label: string | null;
  decision: Decision; reason: string | null; decidedBy: string | null; decidedAt: string; inApp: string; email: EmailState;
}

/** Postgres or PostgREST saying the table is not there yet (migration 204 not applied). */
export const isMissingTable = (e: { code?: string } | null | undefined) => e?.code === "42P01" || e?.code === "PGRST205";

export async function recordReview(r: { subjectType: SubjectType; subjectId: string; userId: string | null; label: string | null; decision: Decision; reason: string | null; decidedBy: string; inApp: "sent" | "none"; email: EmailState }): Promise<{ logged: boolean }> {
  const { error } = await adminDb().from("admin_reviews").insert({ subject_type: r.subjectType, subject_id: r.subjectId, user_id: r.userId, subject_label: r.label, decision: r.decision, reason: r.reason, decided_by: r.decidedBy, in_app: r.inApp, email: r.email });
  if (error && !isMissingTable(error)) console.error("[admin] could not log decision:", error.message);
  return { logged: !error };
}

type Raw = { id: string; subject_type: SubjectType; subject_id: string; user_id: string | null; subject_label: string | null; decision: Decision; reason: string | null; decided_by: string | null; decided_at: string; in_app: string; email: EmailState };
const map = (r: Raw): ReviewRow => ({ id: r.id, subjectType: r.subject_type, subjectId: r.subject_id, userId: r.user_id, label: r.subject_label, decision: r.decision, reason: r.reason, decidedBy: r.decided_by, decidedAt: r.decided_at, inApp: r.in_app, email: r.email });

/** The decision log, newest first, plus whether the table exists at all. */
export async function listReviews(limit = 100): Promise<{ available: boolean; rows: ReviewRow[] }> {
  const res = await adminDb().from("admin_reviews").select("*").order("decided_at", { ascending: false }).limit(limit);
  if (res.error) return { available: !isMissingTable(res.error), rows: [] };
  return { available: true, rows: rowsOf<Raw>(res).map(map) };
}

/** The latest decision per subject, for marking queue items as held or decided. */
export async function latestBySubject(type: SubjectType): Promise<Map<string, ReviewRow>> {
  const res = await adminDb().from("admin_reviews").select("*").eq("subject_type", type).order("decided_at", { ascending: false }).limit(2000);
  const out = new Map<string, ReviewRow>();
  for (const r of rowsOf<Raw>(res)) if (!out.has(r.subject_id)) out.set(r.subject_id, map(r));
  return out;
}
