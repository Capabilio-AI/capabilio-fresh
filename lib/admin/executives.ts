import { adminDb, peopleByIds, rowsOf, safe } from "./db";
import { latestBySubject, type ReviewRow } from "./review-store";

export interface ExecutiveRow {
  id: string; name: string; email: string; roleTitle: string | null; company: string | null; joinedAt: string;
  state: "pending" | "approved" | "rejected" | "hold"; review: ReviewRow | null;
}
export interface ExecutiveAccount { userId: string; name: string | null; email: string | null; organisationId: string | null; createdAt: string }

/**
 * The Executive path is not open yet, so its people are the early-access list (name, email, title, company). Once accounts exist
 * (executive_context rows) they are listed too. Each early-access entry carries the latest decision an admin made.
 */
export async function loadExecutives(): Promise<{ waitlist: ExecutiveRow[]; accounts: ExecutiveAccount[] }> {
  const db = adminDb();
  const [wait, ctx, reviews] = await Promise.all([
    safe(db.from("path_waitlist").select("id, full_name, email, role_title, company, created_at").eq("path", "executive").order("created_at", { ascending: false }).limit(1000), { data: [] } as never, "exec"),
    safe(db.from("executive_context").select("user_id, organisation_id, created_at").limit(1000), { data: [] } as never),
    safe(latestBySubject("executive"), new Map<string, ReviewRow>()),
  ]);
  const waitlist = rowsOf<{ id: string; full_name: string; email: string; role_title: string | null; company: string | null; created_at: string }>(wait).map((w) => {
    const review = reviews.get(w.id) ?? null;
    return { id: w.id, name: w.full_name, email: w.email, roleTitle: w.role_title, company: w.company, joinedAt: w.created_at, state: review ? (review.decision === "approved" ? "approved" : review.decision === "rejected" ? "rejected" : "hold") : "pending", review } as ExecutiveRow;
  });
  const ctxRows = rowsOf<{ user_id: string; organisation_id: string | null; created_at: string }>(ctx);
  const people = await peopleByIds(ctxRows.map((c) => c.user_id));
  return { waitlist, accounts: ctxRows.map((c) => ({ userId: c.user_id, name: people.get(c.user_id)?.name ?? null, email: people.get(c.user_id)?.email ?? null, organisationId: c.organisation_id, createdAt: c.created_at })) };
}
