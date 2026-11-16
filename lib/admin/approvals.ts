import { mentorEvidence } from "@/lib/mentorship/evidence";
import { adminDb, chunk, peopleByIds, rowsOf, safe } from "./db";
import { isOrgRole, isStale, ROLE_LABEL } from "./rules";
import { latestBySubject, type ReviewRow, type SubjectType } from "./review-store";

export interface QueueItem {
  kind: Extract<SubjectType, "mentor" | "organisation" | "executive">;
  /** mentor: the user id; organisation: the membership id; executive: the early-access entry id */
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  title: string;
  detail: string;
  lines: string[];
  submittedAt: string;
  stale: boolean;
  held: { reason: string | null; at: string } | null;
}

/** Everything waiting for a decision, oldest first, with the evidence a reviewer needs to decide. Held items stay in the queue and say why. */
export async function loadQueue(): Promise<QueueItem[]> {
  const db = adminDb();
  const [mentorRows, memRows, waitRows, orgHolds, mentorHolds, execHolds] = await Promise.all([
    safe(db.from("mentor_profiles").select("user_id, headline, bio, expertise, company, role_title, years_experience, created_at, updated_at, review_note").eq("status", "pending"), { data: [] } as never, "q.mentors"),
    safe(db.from("institution_memberships").select("id, user_id, institution_id, role, status, created_at, branch").eq("status", "pending"), { data: [] } as never, "q.orgs"),
    safe(db.from("path_waitlist").select("id, full_name, email, role_title, company, created_at").eq("path", "executive"), { data: [] } as never, "q.exec"),
    safe(latestBySubject("organisation"), new Map<string, ReviewRow>()),
    safe(latestBySubject("mentor"), new Map<string, ReviewRow>()),
    safe(latestBySubject("executive"), new Map<string, ReviewRow>()),
  ]);
  const items: QueueItem[] = [];

  const mentors = rowsOf<{ user_id: string; headline: string; bio: string; expertise: string[]; company: string | null; role_title: string | null; years_experience: number | null; created_at: string; updated_at: string; review_note: string | null }>(mentorRows);
  const mentorPeople = await peopleByIds(mentors.map((m) => m.user_id));
  const evidence = await safe(mentorEvidence(mentors.map((m) => m.user_id)), new Map<string, string[]>());
  for (const m of mentors) {
    const p = mentorPeople.get(m.user_id);
    const hold = mentorHolds.get(m.user_id);
    items.push({
      kind: "mentor", id: m.user_id, userId: m.user_id, name: p?.name ?? "Mentor applicant", email: p?.email ?? null, title: m.headline,
      detail: [[m.role_title, m.company].filter(Boolean).join(" at "), m.years_experience != null ? `${m.years_experience} years` : null].filter(Boolean).join(" · "),
      lines: [m.bio, m.expertise.length ? `Topics: ${m.expertise.join(", ")}` : "", ...(evidence.get(m.user_id) ?? [])].filter(Boolean),
      submittedAt: m.updated_at ?? m.created_at, stale: isStale(m.updated_at ?? m.created_at),
      held: hold?.decision === "hold" ? { reason: hold.reason, at: hold.decidedAt } : null,
    });
  }

  const mems = rowsOf<{ id: string; user_id: string; institution_id: string; role: string; created_at: string; branch: string | null }>(memRows).filter((m) => isOrgRole(m.role));
  const memPeople = await peopleByIds(mems.map((m) => m.user_id));
  const instNames = new Map<string, { name: string; city: string | null; domain: string | null }>();
  for (const part of chunk([...new Set(mems.map((m) => m.institution_id))])) for (const i of rowsOf<{ id: string; name: string; city: string | null; verified_domain: string | null }>(await db.from("institutions").select("id, name, city, verified_domain").in("id", part))) instNames.set(i.id, { name: i.name, city: i.city, domain: i.verified_domain });
  for (const m of mems) {
    const p = memPeople.get(m.user_id);
    const inst = instNames.get(m.institution_id);
    const hold = orgHolds.get(m.id);
    const isCompany = m.role === "company_admin";
    items.push({
      kind: "organisation", id: m.id, userId: m.user_id, name: p?.name ?? "Applicant", email: p?.email ?? null,
      title: `${ROLE_LABEL[m.role] ?? m.role} at ${inst?.name ?? "an organisation"}`,
      detail: [isCompany ? "Company account" : "College account", inst?.city].filter(Boolean).join(" · "),
      lines: [p?.email ? `Signed up with ${p.email}${inst?.domain ? ` (organisation domain ${inst.domain})` : ""}` : "", m.branch ? `Department: ${m.branch}` : ""].filter(Boolean),
      submittedAt: m.created_at, stale: isStale(m.created_at), held: hold?.decision === "hold" ? { reason: hold.reason, at: hold.decidedAt } : null,
    });
  }

  for (const w of rowsOf<{ id: string; full_name: string; email: string; role_title: string | null; company: string | null; created_at: string }>(waitRows)) {
    const review = execHolds.get(w.id);
    if (review && review.decision !== "hold") continue;
    items.push({
      kind: "executive", id: w.id, userId: null, name: w.full_name, email: w.email, title: [w.role_title, w.company].filter(Boolean).join(" at ") || "Executive early access",
      detail: "Executive path · early access", lines: [`Registered with ${w.email}`], submittedAt: w.created_at, stale: isStale(w.created_at), held: review ? { reason: review.reason, at: review.decidedAt } : null,
    });
  }
  return items.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}
