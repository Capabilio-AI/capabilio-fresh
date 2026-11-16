import { adminDb, countOf, HEAD, rowsOf, safe } from "./db";
import { isOrgRole, isStale, lastDays, perDay, STALE_DAYS } from "./rules";

const DAY = 86_400_000;
const since = (days: number) => new Date(Date.now() - days * DAY).toISOString();

export interface Overview {
  people: { total: number; students: number; graduates: number; professionals: number; others: number };
  colleges: { total: number; withStudents: number; students: number };
  companies: { total: number; openings: number; openNow: number; applications: number; hired: number };
  professionals: { total: number; epfoVerified: number; pending: number; mentorInterested: number; mentorsApproved: number };
  executives: { waitlist: number; accounts: number };
  approvals: { mentors: number; organisations: number; executives: number; stale: number };
  signups: { days: string[]; counts: number[]; last7: number; prev7: number };
  funnel: { label: string; value: number }[];
  topEvents: { name: string; count: number }[];
  eventsPerDay: number[];
  alerts: { level: "warn" | "info"; text: string; href: string }[];
  ai: { calls: number; failures: number; costCents: number };
}

type Mem = { institution_id: string; role: string; status: string; user_id: string; created_at: string };

/** Everything the Overview page shows, from counts and one pass over memberships. Each block fails on its own. */
export async function loadOverview(): Promise<Overview> {
  const db = adminDb();
  const days = lastDays(30);
  const [
    total, students, graduates, professionals, memRes, signupRows, proVer, mentorRows, proMentor, openingsRes, appsRes, waitRes, execCtx,
    intent, genSess, genDone, careerDone, eventRows, integrityDay, aiRows, execPending,
  ] = await Promise.all([
    safe(db.from("profiles").select("id", HEAD), { count: 0 } as never, "ov.total"),
    safe(db.from("profiles").select("id", HEAD).eq("student_status", "student"), { count: 0 } as never),
    safe(db.from("profiles").select("id", HEAD).eq("student_status", "graduate"), { count: 0 } as never),
    safe(db.from("profiles").select("id", HEAD).eq("student_status", "professional"), { count: 0 } as never),
    safe(db.from("institution_memberships").select("institution_id, role, status, user_id, created_at").limit(20000), { data: [] } as never),
    safe(db.from("profiles").select("created_at").gte("created_at", since(30)).limit(20000), { data: [] } as never),
    safe(db.from("pro_verification").select("status"), { data: [] } as never),
    safe(db.from("mentor_profiles").select("status, created_at"), { data: [] } as never),
    safe(db.from("pro_mentor_profiles").select("user_id"), { data: [] } as never),
    safe(db.from("job_openings").select("id, status, institution_id"), { data: [] } as never),
    safe(db.from("job_applications").select("status, opening_id"), { data: [] } as never),
    safe(db.from("path_waitlist").select("id, path, created_at"), { data: [] } as never),
    safe(db.from("executive_context").select("user_id", HEAD), { count: 0 } as never),
    safe(db.from("student_career_intent").select("student_id").not("primary_career_id", "is", null), { data: [] } as never),
    safe(db.from("assess_sessions").select("student_id").eq("layer", "GENERAL"), { data: [] } as never),
    safe(db.from("assess_sessions").select("student_id").eq("layer", "GENERAL").eq("status", "COMPLETED"), { data: [] } as never),
    safe(db.from("assess_sessions").select("student_id").eq("layer", "CAREER").eq("status", "COMPLETED"), { data: [] } as never),
    safe(db.from("product_events").select("name, created_at").gte("created_at", since(7)).limit(20000), { data: [] } as never),
    safe(db.from("integrity_events").select("n").gte("created_at", since(1)), { data: [] } as never),
    safe(db.from("ai_call_log").select("status, cost_cents_estimate").gte("created_at", since(7)).limit(20000), { data: [] } as never),
    safe(db.from("admin_reviews").select("subject_id").eq("subject_type", "executive").in("decision", ["approved", "rejected"]), { data: [] } as never),
  ]);

  const mems = rowsOf<Mem>(memRes);
  const staffIds = new Set<string>();
  const studentColleges = new Set<string>();
  const companyIds = new Set<string>();
  let studentMemberships = 0;
  let pendingOrgs = 0;
  for (const m of mems) {
    if (m.role === "student" && m.status === "active") { studentMemberships++; studentColleges.add(m.institution_id); }
    if (m.role === "company_admin") companyIds.add(m.institution_id);
    else if (isOrgRole(m.role)) staffIds.add(m.institution_id);
    if (isOrgRole(m.role) && m.status === "pending") pendingOrgs++;
  }
  const colleges = new Set([...staffIds, ...studentColleges]);

  const openings = rowsOf<{ id: string; status: string; institution_id: string | null }>(openingsRes);
  const apps = rowsOf<{ status: string; opening_id: string }>(appsRes);
  const proStatuses = rowsOf<{ status: string }>(proVer);
  const mentors = rowsOf<{ status: string; created_at: string }>(mentorRows);
  const waitlist = rowsOf<{ id: string; path: string; created_at: string }>(waitRes).filter((w) => w.path === "executive");
  const decided = new Set(rowsOf<{ subject_id: string }>(execPending).map((r) => r.subject_id));
  const pendingExec = waitlist.filter((w) => !decided.has(w.id)).length;
  const pendingMentors = mentors.filter((m) => m.status === "pending");
  const stale =
    pendingMentors.filter((m) => isStale(m.created_at)).length +
    mems.filter((m) => isOrgRole(m.role) && m.status === "pending" && isStale(m.created_at)).length +
    waitlist.filter((w) => !decided.has(w.id) && isStale(w.created_at)).length;

  const signupDates = rowsOf<{ created_at: string }>(signupRows).map((r) => r.created_at);
  const signupCounts = perDay(signupDates, days);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

  const distinct = (rows: { student_id: string }[]) => new Set(rows.map((r) => r.student_id)).size;
  const funnel = [
    { label: "Signed up as students", value: countOf(students) },
    { label: "Started the common assessment", value: distinct(rowsOf(genSess)) },
    { label: "Finished it", value: distinct(rowsOf(genDone)) },
    { label: "Chose a role", value: distinct(rowsOf(intent)) },
    { label: "Finished a role assessment", value: distinct(rowsOf(careerDone)) },
  ];

  const events = rowsOf<{ name: string; created_at: string }>(eventRows);
  const byName = new Map<string, number>();
  for (const e of events) byName.set(e.name, (byName.get(e.name) ?? 0) + 1);
  const topEvents = [...byName].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));

  const integrity = rowsOf<{ n: number }>(integrityDay).reduce((n, r) => n + (r.n ?? 1), 0);
  const aiCalls = rowsOf<{ status: string; cost_cents_estimate: number | null }>(aiRows);
  const aiFailures = aiCalls.filter((c) => c.status && !["ok", "success", "completed"].includes(c.status)).length;

  const approvals = { mentors: pendingMentors.length, organisations: pendingOrgs, executives: pendingExec, stale };
  const alerts: Overview["alerts"] = [];
  if (stale > 0) alerts.push({ level: "warn", text: `${stale} approval${stale === 1 ? " has" : "s have"} waited more than ${STALE_DAYS} days.`, href: "/admin/approvals" });
  if (integrity >= 20) alerts.push({ level: "warn", text: `${integrity} test-integrity events in the last 24 hours.`, href: "/admin/activity" });
  if (aiCalls.length >= 20 && aiFailures / aiCalls.length > 0.1) alerts.push({ level: "warn", text: `${Math.round((aiFailures / aiCalls.length) * 100)}% of AI calls failed this week.`, href: "/admin/activity" });
  if (approvals.mentors + approvals.organisations + approvals.executives > 0 && stale === 0) alerts.push({ level: "info", text: `${approvals.mentors + approvals.organisations + approvals.executives} item(s) waiting for a decision.`, href: "/admin/approvals" });

  const applicationsByOpening = new Set(openings.filter((o) => o.institution_id).map((o) => o.id));
  const companyApps = apps.filter((a) => applicationsByOpening.has(a.opening_id));
  const pTotal = countOf(professionals);

  return {
    people: { total: countOf(total), students: countOf(students), graduates: countOf(graduates), professionals: pTotal, others: Math.max(0, countOf(total) - countOf(students) - countOf(graduates) - pTotal) },
    colleges: { total: colleges.size, withStudents: studentColleges.size, students: studentMemberships },
    companies: { total: companyIds.size, openings: openings.filter((o) => o.institution_id).length, openNow: openings.filter((o) => o.institution_id && o.status === "open").length, applications: companyApps.length, hired: companyApps.filter((a) => a.status === "hired").length },
    professionals: {
      total: pTotal,
      epfoVerified: proStatuses.filter((p) => p.status === "verified").length,
      pending: proStatuses.filter((p) => p.status === "pending").length,
      mentorInterested: new Set([...rowsOf<{ user_id: string }>(proMentor).map((r) => r.user_id)]).size,
      mentorsApproved: mentors.filter((m) => m.status === "approved").length,
    },
    executives: { waitlist: waitlist.length, accounts: countOf(execCtx) },
    approvals,
    signups: { days, counts: signupCounts, last7: sum(signupCounts.slice(-7)), prev7: sum(signupCounts.slice(-14, -7)) },
    funnel,
    topEvents,
    eventsPerDay: perDay(events.map((e) => e.created_at), lastDays(7)),
    alerts,
    ai: { calls: aiCalls.length, failures: aiFailures, costCents: Math.round(aiCalls.reduce((n, c) => n + Number(c.cost_cents_estimate ?? 0), 0)) },
  };
}
