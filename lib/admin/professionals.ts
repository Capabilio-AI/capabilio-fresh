import { experienceMonths, fmtExperience } from "@/lib/professional/experience";
import { MENTOR_MIN_MONTHS } from "@/lib/mentorship/rules";
import { adminDb, chunk, rowsOf, safe } from "./db";

export interface ProRow {
  id: string; name: string | null; email: string | null; employer: string | null; title: string | null;
  experience: string; months: number; epfo: string; mentor: "none" | "interested" | "pending" | "approved" | "rejected" | "suspended"; eligible: boolean; joinedAt: string;
}
export interface ProStats { total: number; epfoVerified: number; epfoPending: number; epfoOther: number; interested: number; mentorsApproved: number; mentorsPending: number; eligible: number }

/** Every professional with their EPFO state, experience and mentorship interest, plus the totals for the header. */
export async function loadProfessionals(): Promise<{ rows: ProRow[]; stats: ProStats }> {
  const db = adminDb();
  const people = rowsOf<{ id: string; full_name: string | null; email: string | null; created_at: string }>(
    await safe(db.from("profiles").select("id, full_name, email, created_at").eq("student_status", "professional").order("created_at", { ascending: false }).limit(2000), { data: [] } as never, "pros"),
  );
  const ids = people.map((p) => p.id);
  const prof = new Map<string, { employer: string | null; title: string | null }>();
  const ver = new Map<string, string>();
  const mentor = new Map<string, string>();
  const optIn = new Set<string>();
  const jobs = new Map<string, { start_date: string | null; end_date: string | null; period_text: string | null }[]>();
  for (const part of chunk(ids)) {
    const [a, b, c, d, e] = await Promise.all([
      db.from("pro_profiles").select("user_id, employer_name, job_title").in("user_id", part),
      db.from("pro_verification").select("user_id, status").in("user_id", part),
      db.from("mentor_profiles").select("user_id, status").in("user_id", part),
      db.from("pro_mentor_profiles").select("user_id").in("user_id", part),
      db.from("pro_employment").select("user_id, start_date, end_date, period_text").in("user_id", part),
    ]);
    for (const r of rowsOf<{ user_id: string; employer_name: string | null; job_title: string | null }>(a)) prof.set(r.user_id, { employer: r.employer_name, title: r.job_title });
    for (const r of rowsOf<{ user_id: string; status: string }>(b)) ver.set(r.user_id, r.status);
    for (const r of rowsOf<{ user_id: string; status: string }>(c)) mentor.set(r.user_id, r.status);
    for (const r of rowsOf<{ user_id: string }>(d)) optIn.add(r.user_id);
    for (const r of rowsOf<{ user_id: string; start_date: string | null; end_date: string | null; period_text: string | null }>(e)) jobs.set(r.user_id, [...(jobs.get(r.user_id) ?? []), r]);
  }
  const rows: ProRow[] = people.map((p) => {
    const months = experienceMonths(jobs.get(p.id) ?? []);
    const m = mentor.get(p.id);
    return {
      id: p.id, name: p.full_name, email: p.email, employer: prof.get(p.id)?.employer ?? null, title: prof.get(p.id)?.title ?? null,
      experience: months > 0 ? fmtExperience(months) : "No dates", months, epfo: ver.get(p.id) ?? "none",
      mentor: (m as ProRow["mentor"]) ?? (optIn.has(p.id) ? "interested" : "none"), eligible: months >= MENTOR_MIN_MONTHS, joinedAt: p.created_at,
    };
  });
  return {
    rows,
    stats: {
      total: rows.length,
      epfoVerified: rows.filter((r) => r.epfo === "verified").length,
      epfoPending: rows.filter((r) => r.epfo === "pending").length,
      epfoOther: rows.filter((r) => ["failed", "deactivated"].includes(r.epfo)).length,
      interested: rows.filter((r) => r.mentor !== "none").length,
      mentorsApproved: rows.filter((r) => r.mentor === "approved").length,
      mentorsPending: rows.filter((r) => r.mentor === "pending").length,
      eligible: rows.filter((r) => r.eligible).length,
    },
  };
}
