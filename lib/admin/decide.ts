import { reviewMentor } from "@/lib/pulse/mentors";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { adminDb, peopleByIds } from "./db";
import { decisionNotice, isOrgRole, type Decision } from "./rules";
import { recordReview, type EmailState, type SubjectType } from "./review-store";
import { createServiceClient } from "@/lib/supabase/service";

export type DecideInput = { adminId: string; kind: Extract<SubjectType, "mentor" | "organisation" | "executive">; id: string; decision: Decision; reason: string | null };
export type DecideResult = { ok: true; inApp: boolean; email: EmailState; logged: boolean } | { ok: false; status: number; error: string };

const SUBJECT: Record<DecideInput["kind"], string> = { mentor: "Mentor application", organisation: "Organisation account", executive: "Executive path request" };
const DEEP_LINK: Record<DecideInput["kind"], string> = { mentor: "/professional/mentor", organisation: "/org", executive: "/" };

/**
 * Applies an admin decision and tells the person. The change itself (mentor status, membership status) is made first; then the user is told in the app
 * and by email with the reason quoted; then the decision is logged. A hold changes nothing about the account, it only records the note. A failure to notify
 * never undoes the decision: the result says what did and did not go out.
 */
export async function applyDecision(i: DecideInput): Promise<DecideResult> {
  const db = adminDb();
  let userId: string | null = null;
  let email: string | null = null;
  let name: string | null = null;
  let label: string | null = null;
  let isPro = false;

  if (i.kind === "mentor") {
    userId = i.id;
    const { data } = await db.from("mentor_profiles").select("user_id").eq("user_id", i.id).maybeSingle();
    if (!data) return { ok: false, status: 404, error: "That mentor application no longer exists." };
    if (i.decision === "hold") await db.from("mentor_profiles").update({ review_note: i.reason, reviewed_by: i.adminId, reviewed_at: new Date().toISOString() }).eq("user_id", i.id);
    else if (!(await reviewMentor(createServiceClient(), i.adminId, i.id, i.decision === "approved" ? "approve" : "reject", i.reason))) return { ok: false, status: 500, error: "Could not save the decision. Try again." };
    isPro = true;
  } else if (i.kind === "organisation") {
    const { data } = await db.from("institution_memberships").select("id, user_id, role, status, institution_id").eq("id", i.id).maybeSingle();
    const m = data as { id: string; user_id: string; role: string; status: string; institution_id: string } | null;
    if (!m) return { ok: false, status: 404, error: "That account request no longer exists." };
    if (!isOrgRole(m.role)) return { ok: false, status: 400, error: "That is not an organisation account." };
    userId = m.user_id;
    if (i.decision !== "hold") {
      const { error } = await db.from("institution_memberships").update({ status: i.decision === "approved" ? "active" : "revoked", updated_at: new Date().toISOString() }).eq("id", i.id);
      if (error) return { ok: false, status: 500, error: "Could not save the decision. Try again." };
    }
    const { data: inst } = await db.from("institutions").select("name").eq("id", m.institution_id).maybeSingle();
    label = (inst as { name: string } | null)?.name ?? null;
  } else {
    const { data } = await db.from("path_waitlist").select("id, full_name, email").eq("id", i.id).maybeSingle();
    const w = data as { id: string; full_name: string; email: string } | null;
    if (!w) return { ok: false, status: 404, error: "That early-access entry no longer exists." };
    email = w.email;
    name = w.full_name;
  }

  if (userId) {
    const p = (await peopleByIds([userId])).get(userId);
    email = p?.email ?? email;
    name = p?.name ?? name;
    isPro = isPro || p?.status === "professional";
  }
  const notice = decisionNotice({ subject: SUBJECT[i.kind], decision: i.decision, reason: i.reason, name });

  let inApp = false;
  if (userId) {
    const row = isPro
      ? await db.from("pro_notifications").insert({ user_id: userId, kind: "system", title: notice.title.slice(0, 120), body: notice.body.slice(0, 300), link: DEEP_LINK[i.kind] })
      : await db.from("notifications").insert({ user_id: userId, type: "review_decision", title: notice.title, body: notice.body, href: DEEP_LINK[i.kind], actor_id: i.adminId, dedupe_key: `review:${i.kind}:${i.id}:${i.decision}:${Date.now()}` });
    inApp = !row.error;
    if (row.error) console.error("[admin] in-app notice failed:", row.error.message);
  }

  let emailState: EmailState = "none";
  if (email) {
    if (!isEmailConfigured()) emailState = "not_configured";
    else emailState = (await sendEmail({ to: email, subject: notice.emailSubject, html: notice.html, text: notice.text })).sent ? "sent" : "failed";
  }

  const { logged } = await recordReview({ subjectType: i.kind, subjectId: i.id, userId, label: label ?? name, decision: i.decision, reason: i.reason, decidedBy: i.adminId, inApp: inApp ? "sent" : "none", email: emailState });
  return { ok: true, inApp, email: emailState, logged };
}
