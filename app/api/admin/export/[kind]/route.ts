import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { audit } from "@/lib/admin/audit";
import { toCsv } from "@/lib/admin/rules";
import { listColleges, loadCollege } from "@/lib/admin/colleges";
import { listPeople } from "@/lib/admin/people";
import { loadProfessionals } from "@/lib/admin/professionals";
import { loadCompanies } from "@/lib/admin/companies";
import { loadExecutives } from "@/lib/admin/executives";
import { listReviews } from "@/lib/admin/review-store";

const iso = (s: string | null) => (s ? s.slice(0, 10) : "");

/** Capabilio admins only: a CSV of a table the console shows. Cells that could run as spreadsheet formulas are neutralised. */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const guard = await requireAdminApi("export");
  if ("error" in guard) return guard.error;
  const { kind } = await params;
  const url = new URL(request.url);
  let header: string[] = [];
  let rows: unknown[][] = [];

  if (kind === "students") {
    const id = url.searchParams.get("college") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Choose a college." }, { status: 400 });
    const c = await loadCollege(id);
    if (!c) return NextResponse.json({ error: "Not found." }, { status: 404 });
    header = ["Name", "Email", "Roll number", "Branch", "Year", "Role chosen", "ELO", "Progress", "Joined"];
    rows = c.students.map((s) => [s.name, s.email, s.rollNumber, s.branch, s.year, s.role, s.elo, s.onboarding, iso(s.joinedAt)]);
  } else if (kind === "colleges") {
    header = ["College", "City", "State", "Students", "Active staff", "Pending staff", "Branches"];
    rows = (await listColleges()).map((c) => [c.name, c.city, c.state, c.students, c.staffActive, c.staffPending, c.branches]);
  } else if (kind === "people") {
    const k = url.searchParams.get("kind");
    const out = [] as Awaited<ReturnType<typeof listPeople>>["rows"];
    for (let page = 1; page <= 40; page++) {
      const r = await listPeople({ kind: k === "student" || k === "graduate" || k === "professional" || k === "other" ? k : "all", q: "", page });
      out.push(...r.rows);
      if (page >= r.pages) break;
    }
    header = ["Name", "Email", "Path", "Headline", "Joined"];
    rows = out.map((p) => [p.name, p.email, p.kind, p.headline, iso(p.joinedAt)]);
  } else if (kind === "professionals") {
    header = ["Name", "Email", "Employer", "Title", "Experience", "EPFO", "Mentorship", "10y eligible", "Joined"];
    rows = (await loadProfessionals()).rows.map((p) => [p.name, p.email, p.employer, p.title, p.experience, p.epfo, p.mentor, p.eligible ? "yes" : "no", iso(p.joinedAt)]);
  } else if (kind === "companies") {
    header = ["Company", "City", "Industry", "Status", "Owner", "Owner email", "Jobs posted", "Open now", "Applications", "Hired"];
    rows = (await loadCompanies()).rows.map((c) => [c.name, c.city, c.industry, c.status, c.owner, c.ownerEmail, c.openings, c.openNow, c.applications, c.hired]);
  } else if (kind === "executives") {
    header = ["Name", "Email", "Title", "Company", "State", "Reason", "Registered"];
    rows = (await loadExecutives()).waitlist.map((e) => [e.name, e.email, e.roleTitle, e.company, e.state, e.review?.reason, iso(e.joinedAt)]);
  } else if (kind === "decisions") {
    header = ["When", "Subject", "Who", "Decision", "Reason", "In-app", "Email"];
    rows = (await listReviews(1000)).rows.map((r) => [r.decidedAt, r.subjectType, r.label, r.decision, r.reason, r.inApp, r.email]);
  } else return NextResponse.json({ error: "Unknown export." }, { status: 404 });

  await audit(guard.admin.userId, "export", kind, `${rows.length} rows`);
  return new NextResponse(toCsv(header, rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="capabilio-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
