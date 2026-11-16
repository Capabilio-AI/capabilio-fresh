import { adminDb, HEAD, countOf, peopleByIds, rowsOf, safe } from "./db";
import { kindOfProfile, type PersonKind } from "./rules";

export const PAGE_SIZE = 25;
export type KindFilter = PersonKind | "all";

export interface PersonRow { id: string; name: string | null; email: string | null; kind: PersonKind; headline: string | null; joinedAt: string }

/** PostgREST treats these as syntax in a filter, so they are dropped from a search string. */
const clean = (q: string) => q.replace(/[%,()*\\]/g, " ").trim().slice(0, 60);

export async function listPeople(opts: { kind: KindFilter; q: string; page: number; nameOnly?: boolean }): Promise<{ rows: PersonRow[]; total: number; pages: number }> {
  const db = adminDb();
  const page = Math.max(1, opts.page);
  let query = db.from("profiles").select("id, full_name, email, student_status, headline, created_at", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (opts.kind === "other") query = query.or("student_status.is.null,student_status.not.in.(student,graduate,professional)");
  else if (opts.kind !== "all") query = query.eq("student_status", opts.kind);
  const q = clean(opts.q);
  if (q) query = opts.nameOnly ? query.ilike("full_name", `%${q}%`) : query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`); // someone who may not see emails cannot find people by them either
  const res = await safe(query, { data: [], count: 0, error: null } as never, "people");
  const rows = rowsOf<{ id: string; full_name: string | null; email: string | null; student_status: string | null; headline: string | null; created_at: string }>(res).map((r) => ({ id: r.id, name: r.full_name, email: r.email, kind: kindOfProfile(r.student_status), headline: r.headline, joinedAt: r.created_at }));
  const total = countOf(res as { count: number | null });
  return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function kindCounts(): Promise<Record<KindFilter, number>> {
  const db = adminDb();
  const [all, s, g, p] = await Promise.all(["", "student", "graduate", "professional"].map((k) => safe(k ? db.from("profiles").select("id", HEAD).eq("student_status", k) : db.from("profiles").select("id", HEAD), { count: 0 } as never)));
  return { all: countOf(all), student: countOf(s), graduate: countOf(g), professional: countOf(p), other: Math.max(0, countOf(all) - countOf(s) - countOf(g) - countOf(p)) };
}

export interface PersonDetail {
  id: string; name: string | null; email: string | null; phone: string | null; kind: PersonKind; headline: string | null; location: string | null; joinedAt: string; plan: string | null;
  memberships: { id: string; institution: string; role: string; status: string; branch: string | null; roll: string | null; year: string | null }[];
  role: { primary: string | null; planB: string | null; exploring: boolean } | null;
  elo: { career: string; rating: number }[];
  onboarding: string | null;
  assessments: { layer: string; status: string; at: string; career: string | null }[];
  pro: { employer: string | null; title: string | null; epfo: string | null; mentor: string | null } | null;
  events: { name: string; at: string }[];
  reviews: { decision: string; subject: string; reason: string | null; at: string }[];
}

/** One person end to end: who they are, where they study or work, the role they chose, their ratings, what they did, and what admins decided about them. */
export async function loadPerson(id: string): Promise<PersonDetail | null> {
  const db = adminDb();
  const [{ data: p }] = await Promise.all([db.from("profiles").select("id, full_name, email, phone, student_status, headline, location, created_at, plan_id").eq("id", id).maybeSingle()]);
  const profile = p as { id: string; full_name: string | null; email: string | null; phone: string | null; student_status: string | null; headline: string | null; location: string | null; created_at: string; plan_id: string | null } | null;
  if (!profile) return null;
  const [mem, intent, eloRes, onb, sess, proProf, ver, mentor, events, reviews] = await Promise.all([
    safe(db.from("institution_memberships").select("id, institution_id, role, status, branch, roll_number, year").eq("user_id", id), { data: [] } as never),
    safe(db.from("student_career_intent").select("primary_career_id, secondary_career_id, is_exploring").eq("student_id", id).maybeSingle(), { data: null } as never),
    safe(db.from("student_career_elo").select("career_id, rating").eq("student_id", id), { data: [] } as never),
    safe(db.from("student_onboarding").select("status").eq("student_id", id).maybeSingle(), { data: null } as never),
    safe(db.from("assess_sessions").select("layer, status, completed_at, started_at, career_id").eq("student_id", id).order("started_at", { ascending: false }).limit(10), { data: [] } as never),
    safe(db.from("pro_profiles").select("employer_name, job_title").eq("user_id", id).maybeSingle(), { data: null } as never),
    safe(db.from("pro_verification").select("status").eq("user_id", id).maybeSingle(), { data: null } as never),
    safe(db.from("mentor_profiles").select("status").eq("user_id", id).maybeSingle(), { data: null } as never),
    safe(db.from("product_events").select("name, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(25), { data: [] } as never),
    safe(db.from("admin_reviews").select("decision, subject_type, reason, decided_at").eq("user_id", id).order("decided_at", { ascending: false }).limit(10), { data: [] } as never),
  ]);
  const memRows = rowsOf<{ id: string; institution_id: string; role: string; status: string; branch: string | null; roll_number: string | null; year: string | null }>(mem);
  const instNames = new Map<string, string>();
  if (memRows.length) for (const i of rowsOf<{ id: string; name: string }>(await db.from("institutions").select("id, name").in("id", memRows.map((m) => m.institution_id)))) instNames.set(i.id, i.name);
  const eloRows = rowsOf<{ career_id: string; rating: number }>(eloRes);
  const intentRow = (intent as { data: { primary_career_id: string | null; secondary_career_id: string | null; is_exploring: boolean } | null }).data;
  const sessRows = rowsOf<{ layer: string; status: string; completed_at: string | null; started_at: string; career_id: string | null }>(sess);
  const careerIds = [...new Set([...eloRows.map((e) => e.career_id), intentRow?.primary_career_id, intentRow?.secondary_career_id, ...sessRows.map((s) => s.career_id)].filter((x): x is string => !!x))];
  const careers = new Map<string, string>();
  if (careerIds.length) for (const c of rowsOf<{ id: string; name: string }>(await db.from("careers").select("id, name").in("id", careerIds))) careers.set(c.id, c.name);
  const pro = (proProf as { data: { employer_name: string | null; job_title: string | null } | null }).data;
  const kind = kindOfProfile(profile.student_status);
  return {
    id, name: profile.full_name, email: profile.email, phone: profile.phone, kind, headline: profile.headline, location: profile.location, joinedAt: profile.created_at, plan: profile.plan_id,
    memberships: memRows.map((m) => ({ id: m.id, institution: instNames.get(m.institution_id) ?? "Unknown", role: m.role, status: m.status, branch: m.branch, roll: m.roll_number, year: m.year })),
    role: intentRow ? { primary: intentRow.primary_career_id ? careers.get(intentRow.primary_career_id) ?? null : null, planB: intentRow.secondary_career_id ? careers.get(intentRow.secondary_career_id) ?? null : null, exploring: intentRow.is_exploring } : null,
    elo: eloRows.map((e) => ({ career: careers.get(e.career_id) ?? "Role", rating: e.rating })),
    onboarding: (onb as { data: { status: string } | null }).data?.status ?? null,
    assessments: sessRows.map((s) => ({ layer: s.layer, status: s.status, at: s.completed_at ?? s.started_at, career: s.career_id ? careers.get(s.career_id) ?? null : null })),
    pro: kind === "professional" ? { employer: pro?.employer_name ?? null, title: pro?.job_title ?? null, epfo: (ver as { data: { status: string } | null }).data?.status ?? null, mentor: (mentor as { data: { status: string } | null }).data?.status ?? null } : null,
    events: rowsOf<{ name: string; created_at: string }>(events).map((e) => ({ name: e.name, at: e.created_at })),
    reviews: rowsOf<{ decision: string; subject_type: string; reason: string | null; decided_at: string }>(reviews).map((r) => ({ decision: r.decision, subject: r.subject_type, reason: r.reason, at: r.decided_at })),
  };
}

export { peopleByIds };
