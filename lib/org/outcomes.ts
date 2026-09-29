import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { MIN_COHORT } from "./insights";
import { untyped } from "./db";

export interface PlacementRecord {
  id: string;
  studentUserId: string;
  studentName: string;
  branch: string | null;
  company: string;
  roleTitle: string;
  ctcLpa: number | null;
  offerDate: string | null;
  confirmedAt: string;
  showOnWall: boolean;
  /** set when the placement came from one of the institution's own drives */
  opportunityId: string | null;
}

export interface PlacementStats {
  placed: number;
  companies: number;
  /** null until at least MIN_COHORT placements carry a CTC, so one salary is never shown as "average" */
  ctc: { average: number; median: number; highest: number } | null;
  /** per branch; count is null (hidden) below MIN_COHORT */
  byBranch: { branch: string; count: number | null }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Pure. Counts distinct students (a student with two confirmed offers is one placed student). */
export function summarizePlacements(rows: PlacementRecord[]): PlacementStats {
  const students = new Map<string, PlacementRecord>();
  for (const r of rows) if (!students.has(r.studentUserId)) students.set(r.studentUserId, r);

  const ctcs = rows.map((r) => r.ctcLpa).filter((c): c is number => c !== null).sort((a, b) => a - b);
  const median = ctcs.length === 0 ? 0 : ctcs.length % 2 ? ctcs[(ctcs.length - 1) / 2] : (ctcs[ctcs.length / 2 - 1] + ctcs[ctcs.length / 2]) / 2;

  const byBranch = new Map<string, number>();
  for (const s of students.values()) byBranch.set(s.branch ?? "Unspecified", (byBranch.get(s.branch ?? "Unspecified") ?? 0) + 1);

  return {
    placed: students.size,
    companies: new Set(rows.map((r) => r.company.trim().toLowerCase())).size,
    ctc: ctcs.length >= MIN_COHORT ? { average: round1(ctcs.reduce((a, b) => a + b, 0) / ctcs.length), median: round1(median), highest: ctcs[ctcs.length - 1] } : null,
    byBranch: [...byBranch.entries()].map(([branch, count]) => ({ branch, count: count >= MIN_COHORT ? count : null })).sort((a, b) => a.branch.localeCompare(b.branch)),
  };
}

export interface Funnel {
  applied: number;
  shortlisted: number;
  selected: number;
  placed: number;
}

/** Pure. Each stage counts applicants who reached AT LEAST that stage ('rejected' stops at applied). */
export function buildFunnel(statuses: string[], placedFromDrives: number): Funnel {
  return {
    applied: statuses.length,
    shortlisted: statuses.filter((s) => s === "shortlisted" || s === "accepted").length,
    selected: statuses.filter((s) => s === "accepted").length,
    placed: placedFromDrives,
  };
}

export async function loadPlacements(service: SupabaseClient<Database>, institutionId: string): Promise<PlacementRecord[]> {
  const { data } = await untyped(service).from("org_placements").select("*").eq("institution_id", institutionId).order("confirmed_at", { ascending: false });
  const rows = (data ?? []) as {
    id: string;
    student_user_id: string;
    company: string;
    role_title: string;
    ctc_lpa: number | string | null;
    offer_date: string | null;
    confirmed_at: string;
    show_on_wall: boolean;
    opportunity_id: string | null;
  }[];
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.student_user_id))];
  const [{ data: profiles }, { data: memberships }] = await Promise.all([
    service.from("profiles").select("id, full_name, email").in("id", ids),
    service.from("institution_memberships").select("user_id, branch").eq("institution_id", institutionId).in("user_id", ids),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  const branches = new Map((memberships ?? []).map((m) => [m.user_id, m.branch]));
  return rows.map((r) => ({
    id: r.id,
    studentUserId: r.student_user_id,
    studentName: names.get(r.student_user_id) ?? "Student",
    branch: branches.get(r.student_user_id) ?? null,
    company: r.company,
    roleTitle: r.role_title,
    ctcLpa: r.ctc_lpa === null ? null : Number(r.ctc_lpa),
    offerDate: r.offer_date,
    confirmedAt: r.confirmed_at,
    showOnWall: r.show_on_wall,
    opportunityId: r.opportunity_id,
  }));
}

export async function loadOutcomes(service: SupabaseClient<Database>, institutionId: string) {
  const placements = await loadPlacements(service, institutionId);
  const { data: drives } = await service.from("opportunities").select("id").eq("institution_id", institutionId);
  const driveIds = (drives ?? []).map((d) => d.id);
  const { data: apps } = driveIds.length ? await service.from("applications").select("status").in("opportunity_id", driveIds) : { data: [] };
  const fromDrives = placements.filter((p) => p.opportunityId !== null).length; // every placement is officer-confirmed by construction
  return {
    placements,
    stats: summarizePlacements(placements),
    funnel: buildFunnel((apps ?? []).map((a) => a.status), fromDrives),
    driveCount: driveIds.length,
  };
}

const csvCell = (v: string | number | null): string => {
  const s = v === null ? "" : String(v);
  // neutralise spreadsheet formula injection as well as quoting
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Pure. Confirmed placements as CSV (NAAC-style working sheet). */
export function placementsToCsv(rows: PlacementRecord[]): string {
  const header = ["Student", "Branch", "Company", "Role", "CTC (LPA)", "Offer date", "Confirmed on"];
  const lines = rows.map((r) => [r.studentName, r.branch, r.company, r.roleTitle, r.ctcLpa, r.offerDate, r.confirmedAt.slice(0, 10)].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}
