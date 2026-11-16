import { adminDb, chunk, peopleByIds, rowsOf, safe } from "./db";
import { isOrgRole } from "./rules";

export interface CollegeRow {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  students: number;
  staffActive: number;
  staffPending: number;
  branches: number;
  lastJoined: string | null;
}

type Mem = { institution_id: string; user_id: string; role: string; status: string; branch: string | null; created_at: string };
type Inst = { id: string; name: string; city: string | null; state: string | null; college_type: string | null; college_code: string | null };

async function institutions(ids: readonly string[]): Promise<Map<string, Inst>> {
  const db = adminDb();
  const out = new Map<string, Inst>();
  for (const part of chunk(ids)) {
    const { data } = await db.from("institutions").select("id, name, city, state, college_type, college_code").in("id", part);
    for (const i of (data ?? []) as Inst[]) out.set(i.id, i);
  }
  return out;
}

/** Colleges that have at least one student or staff member, with their headcounts. A company's workspace is not a college. */
export async function listColleges(q = ""): Promise<CollegeRow[]> {
  const mems = rowsOf<Mem>(await safe(adminDb().from("institution_memberships").select("institution_id, user_id, role, status, branch, created_at").limit(20000), { data: [] } as never, "colleges"));
  const companyIds = new Set(mems.filter((m) => m.role === "company_admin").map((m) => m.institution_id));
  const by = new Map<string, Mem[]>();
  for (const m of mems) if (!companyIds.has(m.institution_id)) by.set(m.institution_id, [...(by.get(m.institution_id) ?? []), m]);
  const insts = await institutions([...by.keys()]);
  const needle = q.trim().toLowerCase();
  return [...by]
    .flatMap(([id, ms]) => {
      const inst = insts.get(id);
      if (!inst || (needle && !`${inst.name} ${inst.city ?? ""} ${inst.state ?? ""}`.toLowerCase().includes(needle))) return [];
      const students = ms.filter((m) => m.role === "student" && m.status === "active");
      return [{
        id, name: inst.name, city: inst.city, state: inst.state,
        students: students.length,
        staffActive: ms.filter((m) => isOrgRole(m.role) && m.status === "active").length,
        staffPending: ms.filter((m) => isOrgRole(m.role) && m.status === "pending").length,
        branches: new Set(students.map((s) => s.branch).filter(Boolean)).size,
        lastJoined: ms.map((m) => m.created_at).sort().at(-1) ?? null,
      }];
    })
    .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));
}

export interface StudentRow {
  userId: string;
  name: string | null;
  email: string | null;
  rollNumber: string | null;
  branch: string | null;
  year: string | null;
  role: string | null;
  elo: number | null;
  onboarding: string | null;
  joinedAt: string;
}
export interface StaffRow { membershipId: string; userId: string; name: string | null; email: string | null; role: string; status: string; createdAt: string }
export interface CollegeDetail {
  college: Inst;
  students: StudentRow[];
  staff: StaffRow[];
  branches: { branch: string; students: number; withRole: number }[];
  totals: { students: number; withRole: number; assessed: number; avgElo: number | null };
}

/** One college: its students (name, roll number, branch, role chosen, rating, progress), staff, and a branch breakdown. */
export async function loadCollege(id: string): Promise<CollegeDetail | null> {
  const db = adminDb();
  const insts = await institutions([id]);
  const college = insts.get(id);
  if (!college) return null;
  const mems = rowsOf<Mem & { id: string; roll_number: string | null; year: string | null; start_year: number | null; end_year: number | null }>(
    await safe(db.from("institution_memberships").select("id, user_id, institution_id, role, status, branch, year, start_year, end_year, roll_number, created_at").eq("institution_id", id).limit(5000), { data: [] } as never, "college"),
  );
  const studentMems = mems.filter((m) => m.role === "student" && m.status === "active");
  const userIds = mems.map((m) => m.user_id);
  const people = await peopleByIds(userIds);
  const sids = studentMems.map((m) => m.user_id);

  const intents = new Map<string, string | null>();
  const elo = new Map<string, number>();
  const onboarding = new Map<string, string>();
  const careerName = new Map<string, string>();
  for (const part of chunk(sids)) {
    const [i, e, o] = await Promise.all([
      db.from("student_career_intent").select("student_id, primary_career_id").in("student_id", part),
      db.from("student_career_elo").select("student_id, career_id, rating").in("student_id", part),
      db.from("student_onboarding").select("student_id, status").in("student_id", part),
    ]);
    for (const r of rowsOf<{ student_id: string; primary_career_id: string | null }>(i)) intents.set(r.student_id, r.primary_career_id);
    for (const r of rowsOf<{ student_id: string; career_id: string; rating: number }>(e)) {
      const primary = intents.get(r.student_id);
      if (!elo.has(r.student_id) || r.career_id === primary) elo.set(r.student_id, r.rating);
    }
    for (const r of rowsOf<{ student_id: string; status: string }>(o)) onboarding.set(r.student_id, r.status);
  }
  const careerIds = [...new Set([...intents.values()].filter((x): x is string => !!x))];
  for (const part of chunk(careerIds)) for (const c of rowsOf<{ id: string; name: string }>(await db.from("careers").select("id, name").in("id", part))) careerName.set(c.id, c.name);

  const students: StudentRow[] = studentMems.map((m) => {
    const p = people.get(m.user_id);
    const primary = intents.get(m.user_id);
    return {
      userId: m.user_id, name: p?.name ?? null, email: p?.email ?? null, rollNumber: m.roll_number, branch: m.branch,
      year: m.year ?? (m.start_year && m.end_year ? `${m.start_year}–${m.end_year}` : null),
      role: primary ? careerName.get(primary) ?? null : null,
      elo: elo.get(m.user_id) ?? null, onboarding: onboarding.get(m.user_id) ?? null, joinedAt: m.created_at,
    };
  }).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  const staff: StaffRow[] = mems.filter((m) => isOrgRole(m.role)).map((m) => {
    const p = people.get(m.user_id);
    return { membershipId: m.id, userId: m.user_id, name: p?.name ?? null, email: p?.email ?? null, role: m.role, status: m.status, createdAt: m.created_at };
  });

  const byBranch = new Map<string, { students: number; withRole: number }>();
  for (const s of students) {
    const b = s.branch ?? "Not set";
    const cur = byBranch.get(b) ?? { students: 0, withRole: 0 };
    cur.students++;
    if (s.role) cur.withRole++;
    byBranch.set(b, cur);
  }
  const elos = students.map((s) => s.elo).filter((x): x is number => x != null);
  return {
    college, students, staff,
    branches: [...byBranch].map(([branch, v]) => ({ branch, ...v })).sort((a, b) => b.students - a.students),
    totals: { students: students.length, withRole: students.filter((s) => s.role).length, assessed: students.filter((s) => s.onboarding === "PROFILE_READY").length, avgElo: elos.length ? Math.round(elos.reduce((a, b) => a + b, 0) / elos.length) : null },
  };
}
