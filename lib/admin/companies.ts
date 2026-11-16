import { adminDb, chunk, peopleByIds, rowsOf, safe } from "./db";

export interface CompanyRow {
  id: string; name: string; city: string | null; industry: string | null; status: "active" | "pending" | "revoked"; owner: string | null; ownerEmail: string | null;
  openings: number; openNow: number; applications: number; shortlisted: number; hired: number; joinedAt: string; membershipId: string;
}
export interface CompanyTotals { companies: number; active: number; pending: number; openings: number; openNow: number; applications: number; hired: number }

/** Every company workspace (an organisation with a company admin) with the jobs it posted and what came of them. */
export async function loadCompanies(): Promise<{ rows: CompanyRow[]; totals: CompanyTotals }> {
  const db = adminDb();
  const mems = rowsOf<{ id: string; institution_id: string; user_id: string; status: string; created_at: string }>(
    await safe(db.from("institution_memberships").select("id, institution_id, user_id, status, created_at").eq("role", "company_admin").limit(2000), { data: [] } as never, "companies"),
  );
  const ids = [...new Set(mems.map((m) => m.institution_id))];
  const inst = new Map<string, { name: string; city: string | null }>();
  const profile = new Map<string, { industry: string | null; hq_city: string | null }>();
  const openings = new Map<string, { id: string; status: string }[]>();
  for (const part of chunk(ids)) {
    const [i, p, o] = await Promise.all([
      db.from("institutions").select("id, name, city").in("id", part),
      db.from("company_profiles").select("institution_id, industry, hq_city").in("institution_id", part),
      db.from("job_openings").select("id, status, institution_id").in("institution_id", part),
    ]);
    for (const r of rowsOf<{ id: string; name: string; city: string | null }>(i)) inst.set(r.id, { name: r.name, city: r.city });
    for (const r of rowsOf<{ institution_id: string; industry: string | null; hq_city: string | null }>(p)) profile.set(r.institution_id, r);
    for (const r of rowsOf<{ id: string; status: string; institution_id: string }>(o)) openings.set(r.institution_id, [...(openings.get(r.institution_id) ?? []), r]);
  }
  const openingIds = [...openings.values()].flat().map((o) => o.id);
  const appsBy = new Map<string, string[]>();
  for (const part of chunk(openingIds)) for (const a of rowsOf<{ opening_id: string; status: string }>(await db.from("job_applications").select("opening_id, status").in("opening_id", part))) appsBy.set(a.opening_id, [...(appsBy.get(a.opening_id) ?? []), a.status]);
  const people = await peopleByIds(mems.map((m) => m.user_id));

  const rows: CompanyRow[] = mems.map((m) => {
    const ops = openings.get(m.institution_id) ?? [];
    const statuses = ops.flatMap((o) => appsBy.get(o.id) ?? []);
    const owner = people.get(m.user_id);
    return {
      id: m.institution_id, membershipId: m.id, name: inst.get(m.institution_id)?.name ?? "Company", city: profile.get(m.institution_id)?.hq_city ?? inst.get(m.institution_id)?.city ?? null,
      industry: profile.get(m.institution_id)?.industry ?? null, status: m.status as CompanyRow["status"], owner: owner?.name ?? null, ownerEmail: owner?.email ?? null,
      openings: ops.length, openNow: ops.filter((o) => o.status === "open").length, applications: statuses.length,
      shortlisted: statuses.filter((s) => s === "shortlisted").length, hired: statuses.filter((s) => s === "hired").length, joinedAt: m.created_at,
    };
  }).sort((a, b) => b.openings - a.openings || a.name.localeCompare(b.name));
  const sum = (f: (r: CompanyRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  return { rows, totals: { companies: rows.length, active: rows.filter((r) => r.status === "active").length, pending: rows.filter((r) => r.status === "pending").length, openings: sum((r) => r.openings), openNow: sum((r) => r.openNow), applications: sum((r) => r.applications), hired: sum((r) => r.hired) } };
}
